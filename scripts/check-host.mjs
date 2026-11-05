import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('../', import.meta.url);
const root = fileURLToPath(rootUrl);
const osTemporary = tmpdir();
const prefix = join(osTemporary, 'hetzner-cloud-codex-check-');
const temporary = await mkdtemp(prefix);
const profile = join(temporary, 'profile');
const env = { ...process.env, CODEX_HOME: profile };
delete env.HETZNER_API_TOKEN;
const executable = process.env.CODEX_CLI_PATH ?? 'codex';
const manifestPath = join(root, 'plugins/hetzner-cloud/.codex-plugin/plugin.json');
const manifestText = await readFile(manifestPath, 'utf8');
const manifest = JSON.parse(manifestText);
const operationsPath = join(root, 'src/generated/operations.json');
const operationsText = await readFile(operationsPath, 'utf8');
const operations = JSON.parse(operationsText);
let host;
let output;
const pending = new Map();
let nextId = 1;
let diagnostics = '';

function codex(args) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function rejectPending(error) {
  for (const entry of pending.values()) {
    clearTimeout(entry.timeout);
    entry.reject(error);
  }
  pending.clear();
}

function send(message) {
  const encoded = JSON.stringify(message);
  host.stdin.write(`${encoded}\n`);
}

function request(method, params) {
  const id = nextId;
  nextId += 1;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      const error = new Error(`Codex request timed out: ${method}. ${diagnostics}`);
      reject(error);
    }, 30_000);
    pending.set(id, { resolve, reject, timeout });
    send({ id, method, params });
  });
}

try {
  await mkdir(profile);
  codex(['plugin', 'marketplace', 'add', root, '--json']);
  const installed = codex(['plugin', 'add', 'hetzner-cloud@hetzner-cloud', '--json']);
  host = spawn(executable, ['--no-daemon', 'app-server', '--stdio'], {
    cwd: root,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  output = createInterface({ input: host.stdout });
  host.stderr.on('data', chunk => { diagnostics += chunk; });
  host.on('error', rejectPending);
  host.on('exit', code => {
    const error = new Error(`Codex app-server exited with ${code}. ${diagnostics}`);
    rejectPending(error);
  });
  output.on('line', line => {
    const message = JSON.parse(line);
    const entry = pending.get(message.id);
    if (entry === undefined) return;
    clearTimeout(entry.timeout);
    pending.delete(message.id);
    if (message.error) {
      const error = new Error(message.error.message);
      entry.reject(error);
    } else entry.resolve(message.result);
  });

  await request('initialize', {
    clientInfo: { name: 'hetzner-cloud-host-check', title: 'Hetzner Cloud host check', version: manifest.version },
    capabilities: { experimentalApi: true, requestAttestation: false },
  });
  send({ method: 'initialized' });
  const catalog = await request('plugin/list', { marketplaceKinds: ['local'], cwds: [root] });
  const marketplace = catalog.marketplaces.find(item => item.name === 'hetzner-cloud');
  assert.ok(marketplace, 'Codex did not discover the marketplace.');
  const details = await request('plugin/read', { marketplacePath: marketplace.path, pluginName: 'hetzner-cloud' });
  const plugin = details.plugin;
  assert.equal(plugin.summary.installed, true);
  assert.equal(plugin.summary.enabled, true);
  assert.equal(plugin.summary.localVersion, manifest.version);
  assert.ok(plugin.onboardingSkill, 'Codex did not expose the native setup skill.');
  assert.equal(plugin.onboardingSkill.name, 'hetzner-cloud:hetzner-cloud-setup');
  assert.equal(plugin.onboardingSkill.enabled, true);
  const onboardingRelativePath = './skills/hetzner-cloud-setup/SKILL.md';
  const sourceOnboardingPath = join(plugin.summary.source.path, onboardingRelativePath);
  assert.equal(plugin.onboardingSkill.path, sourceOnboardingPath);
  assert.equal(plugin.mcpServers.length, 0);
  const skillNames = plugin.skills.map(skill => skill.name);
  skillNames.sort();
  assert.deepEqual(skillNames, ['hetzner-cloud:hetzner-cloud', 'hetzner-cloud:hetzner-cloud-setup']);
  for (const skill of plugin.skills) {
    assert.equal(skill.enabled, true);
  }
  const installedClientPath = join(installed.installedPath, 'dist/client.mjs');
  const standalone = spawnSync(process.execPath, [installedClientPath, 'list'], {
    cwd: installed.installedPath,
    env: { ...env, PATH: '/usr/bin:/bin' },
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
  if (standalone.error) throw standalone.error;
  assert.equal(standalone.status, 0, standalone.stderr);
  const listed = JSON.parse(standalone.stdout);
  assert.equal(listed.count, operations.length);
  const actualNames = listed.operations.map(operation => operation.name);
  actualNames.sort();
  const expectedNames = operations.map(operation => operation.name);
  expectedNames.sort();
  assert.deepEqual(actualNames, expectedNames);
  const installedFiles = await readdir(installed.installedPath);
  const hasMcpConfig = installedFiles.includes('.mcp.json');
  assert.equal(hasMcpConfig, false);
  const installedManifestPath = join(installed.installedPath, '.codex-plugin/plugin.json');
  const installedManifestText = await readFile(installedManifestPath, 'utf8');
  const installedManifest = JSON.parse(installedManifestText);
  assert.equal(installedManifest.mcpServers, undefined);
  assert.equal(installedManifest.extensions['com.openai'].onboardingSkill, onboardingRelativePath);
  assert.equal(installedManifest.requires_local_executor, true);
  const onboardingPath = join(installed.installedPath, onboardingRelativePath);
  await readFile(onboardingPath, 'utf8');
  console.log(`Codex installed ${manifest.version} with both skills and native setup, registered zero MCP servers, and the standalone client listed ${listed.count} operations with a minimal PATH.`);
} finally {
  if (output) output.close();
  if (host) {
    host.stdin.end();
    host.kill('SIGTERM');
    await new Promise(resolve => {
      if (host.exitCode !== null) resolve();
      else host.once('exit', resolve);
    });
  }
  await rm(temporary, { recursive: true, force: true });
}
