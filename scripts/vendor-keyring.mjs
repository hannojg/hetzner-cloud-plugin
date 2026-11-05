import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const rootUrl = new URL('../', import.meta.url);
const root = fileURLToPath(rootUrl);
const nativeDirectory = join(root, 'plugins/hetzner-cloud/dist/native');
const packageVersion = '2.1.2';
const targets = [
  'darwin-arm64',
  'darwin-x64',
  'win32-arm64-msvc',
  'win32-x64-msvc',
  'linux-arm64-gnu',
  'linux-arm64-musl',
  'linux-x64-gnu',
  'linux-x64-musl',
];

const loader = `const { platform, arch } = process;
let target;
if (platform === 'darwin' && (arch === 'arm64' || arch === 'x64')) {
  target = platform + '-' + arch;
} else if (platform === 'win32' && (arch === 'arm64' || arch === 'x64')) {
  target = platform + '-' + arch + '-msvc';
} else if (platform === 'linux' && (arch === 'arm64' || arch === 'x64')) {
  const report = process.report.getReport();
  const libc = report.header.glibcVersionRuntime ? 'gnu' : 'musl';
  target = platform + '-' + arch + '-' + libc;
} else {
  throw new Error('Hetzner Cloud credential storage does not support ' + platform + '/' + arch + '.');
}
const binding = require('./keyring.' + target + '.node');
exports.AsyncEntry = binding.AsyncEntry;
`;

const readme = `# Native credential storage

The plugin bundles the published native binaries from [@napi-rs/keyring](https://github.com/Brooooooklyn/keyring-node), version ${packageVersion}.
No native package is downloaded when the plugin starts.

Supported targets: ${targets.join(', ')}.
macOS uses Keychain, Windows uses Credential Manager, and Linux requires a running Secret Service such as GNOME Keyring or KWallet.
Linux entries are explicitly pinned to Secret Service; the kernel keyring is not used.
Other operating systems and architectures are unsupported and produce an explicit error when credential storage is used.

Native loading and credential access are lazy. Listing MCP tools never opens a credential store.
The loader selects exactly one binary from the current OS, architecture, and Node.js libc report.

manifest.json records the npm source URL, npm integrity, and SHA-256 of each committed binary and license.
The upstream MIT license is in LICENSE.keyring; complete platform-specific dependency notices are in licenses/.
Linux notices include the statically linked libdbus license.

Maintainers can regenerate these assets with node scripts/vendor-keyring.mjs.
node scripts/vendor-keyring.mjs --check verifies the committed assets without network access and runs as part of every build.
`;

function checksum(bytes) {
  const hash = createHash('sha256');
  hash.update(bytes);
  return hash.digest('hex');
}

function npmSource(target) {
  return `https://registry.npmjs.org/@napi-rs/keyring-${target}/-/keyring-${target}-${packageVersion}.tgz`;
}

async function writeArtifact(path, bytes) {
  const fullPath = join(nativeDirectory, path);
  await writeFile(fullPath, bytes);
  const sha256 = checksum(bytes);
  return { path, sha256 };
}

async function downloadTarget(target, temporaryDirectory) {
  const packageName = `@napi-rs/keyring-${target}`;
  const selector = `${packageName}@${packageVersion}`;
  const args = ['pack', selector, '--ignore-scripts', '--json', '--pack-destination', temporaryDirectory];
  const { stdout } = await run('npm', args, { cwd: root, maxBuffer: 1_048_576 });
  const [metadata] = JSON.parse(stdout);
  if (metadata.name !== packageName || metadata.version !== packageVersion) {
    throw new Error(`Unexpected npm package for ${selector}.`);
  }
  const archive = join(temporaryDirectory, metadata.filename);
  const extractDirectory = join(temporaryDirectory, target);
  await mkdir(extractDirectory);
  await run('tar', ['-xzf', archive, '-C', extractDirectory, '--strip-components=1']);
  const binaryName = `keyring.${target}.node`;
  const binaryPath = join(extractDirectory, binaryName);
  const binary = await readFile(binaryPath);
  const binaryArtifact = await writeArtifact(binaryName, binary);
  const licensePath = join(extractDirectory, 'LICENSE.third-party.md');
  const license = await readFile(licensePath);
  const licenseArtifact = await writeArtifact(`licenses/${target}.md`, license);
  return {
    target,
    package: packageName,
    version: packageVersion,
    source: npmSource(target),
    integrity: metadata.integrity,
    files: [binaryArtifact, licenseArtifact],
  };
}

export async function vendorKeyring() {
  const licenseDirectory = join(nativeDirectory, 'licenses');
  await mkdir(licenseDirectory, { recursive: true });
  const temporaryRoot = tmpdir();
  const temporaryPrefix = join(temporaryRoot, 'hetzner-keyring-vendor-');
  const temporaryDirectory = await mkdtemp(temporaryPrefix);
  try {
    const downloads = targets.map(target => downloadTarget(target, temporaryDirectory));
    const artifacts = await Promise.all(downloads);
    const upstreamLicensePath = join(root, 'node_modules/@napi-rs/keyring/LICENSE');
    const upstreamLicense = await readFile(upstreamLicensePath);
    const loaderArtifact = await writeArtifact('keyring.cjs', loader);
    const licenseArtifact = await writeArtifact('LICENSE.keyring', upstreamLicense);
    const readmeArtifact = await writeArtifact('README.md', readme);
    const manifest = {
      package: '@napi-rs/keyring',
      version: packageVersion,
      upstream: 'https://github.com/Brooooooklyn/keyring-node',
      artifacts,
      files: [loaderArtifact, licenseArtifact, readmeArtifact],
    };
    const json = JSON.stringify(manifest, null, 2);
    const manifestPath = join(nativeDirectory, 'manifest.json');
    await writeFile(manifestPath, `${json}\n`);
    await verifyNativeArtifacts();
    console.log(`Vendored ${artifacts.length} native credential-store targets.`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function verifyArtifact(file) {
  const path = join(nativeDirectory, file.path);
  const bytes = await readFile(path);
  const actual = checksum(bytes);
  if (actual !== file.sha256) {
    throw new Error(`Native credential-store asset has changed: ${file.path}.`);
  }
}

export async function verifyNativeArtifacts() {
  const manifestPath = join(nativeDirectory, 'manifest.json');
  const json = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(json);
  if (manifest.package !== '@napi-rs/keyring' || manifest.version !== packageVersion) {
    throw new Error('Native credential-store manifest is out of date. Run node scripts/vendor-keyring.mjs.');
  }
  const bundledTargets = manifest.artifacts.map(artifact => artifact.target);
  const expectedTargets = JSON.stringify(targets);
  const actualTargets = JSON.stringify(bundledTargets);
  if (actualTargets !== expectedTargets) {
    throw new Error('Native credential-store target list is out of date.');
  }
  for (const artifact of manifest.artifacts) {
    const expectedPackage = `@napi-rs/keyring-${artifact.target}`;
    const expectedSource = npmSource(artifact.target);
    if (artifact.package !== expectedPackage || artifact.version !== packageVersion || artifact.source !== expectedSource) {
      throw new Error(`Invalid native credential-store provenance: ${artifact.target}.`);
    }
    const expectedFiles = [`keyring.${artifact.target}.node`, `licenses/${artifact.target}.md`];
    const actualFiles = artifact.files.map(file => file.path);
    const expectedJson = JSON.stringify(expectedFiles);
    const actualJson = JSON.stringify(actualFiles);
    if (actualJson !== expectedJson) {
      throw new Error(`Invalid native credential-store file list: ${artifact.target}.`);
    }
    for (const file of artifact.files) {
      await verifyArtifact(file);
    }
  }
  for (const file of manifest.files) {
    await verifyArtifact(file);
  }
  const loaderPath = join(nativeDirectory, 'keyring.cjs');
  const actualLoader = await readFile(loaderPath, 'utf8');
  const readmePath = join(nativeDirectory, 'README.md');
  const actualReadme = await readFile(readmePath, 'utf8');
  if (actualLoader !== loader || actualReadme !== readme) {
    throw new Error('Native credential-store support files are out of date.');
  }
  const expectedEntries = targets.map(target => `keyring.${target}.node`);
  expectedEntries.push('LICENSE.keyring', 'README.md', 'keyring.cjs', 'licenses', 'manifest.json');
  expectedEntries.sort();
  const actualEntries = await readdir(nativeDirectory);
  actualEntries.sort();
  const expected = JSON.stringify(expectedEntries);
  const actual = JSON.stringify(actualEntries);
  if (actual !== expected) {
    throw new Error('Unexpected files in the native credential-store bundle.');
  }
}

const invoked = process.argv[1];
const thisFile = fileURLToPath(import.meta.url);
if (invoked !== undefined) {
  const invokedPath = resolve(invoked);
  if (invokedPath === thisFile) {
    const check = process.argv.includes('--check');
    if (check) {
      await verifyNativeArtifacts();
      console.log('Native credential-store assets verified.');
    } else {
      await vendorKeyring();
    }
  }
}
