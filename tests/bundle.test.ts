import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { operations } from '../src/generated/operations.js';

const executeFile = promisify(execFile);

test('standalone client lists and describes APIs with the restricted desktop PATH and no credentials', { timeout: 30000 }, async () => {
  const temporaryRoot = tmpdir();
  const prefix = join(temporaryRoot, 'hetzner-direct-test-');
  const temporaryPath = await mkdtemp(prefix);
  const pluginUrl = new URL('../plugins/hetzner-cloud/', import.meta.url);
  const pluginPath = fileURLToPath(pluginUrl);
  await cp(pluginPath, temporaryPath, { recursive: true });
  const bundle = join(temporaryPath, 'dist', 'client.mjs');
  const env = { ...process.env, PATH: '/usr/bin:/bin' };
  const options = { cwd: temporaryPath, env, timeout: 10000 };
  try {
    const listed = await executeFile(process.execPath, [bundle, 'list'], options);
    assert.equal(listed.stderr, '');
    const listPayload = JSON.parse(listed.stdout);
    assert.equal(listPayload.count, 222);
    assert.equal(listPayload.operations.length, 222);
    const selected = operations.find((item) => item.api === 'cloud' && item.operationId === 'list_servers');
    assert.ok(selected);
    const described = await executeFile(process.execPath, [bundle, 'describe', selected.name], options);
    assert.equal(described.stderr, '');
    const description = JSON.parse(described.stdout);
    const serialized = JSON.stringify(description);
    const describesSelected = serialized.includes(selected.name);
    assert.equal(describesSelected, true);
  } finally {
    await rm(temporaryPath, { recursive: true, force: true });
  }
});
