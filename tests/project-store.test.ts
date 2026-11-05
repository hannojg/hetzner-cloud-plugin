import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { KeyringProjectStore, normalizeProjectName } from '../src/project-store.js';
import type { CredentialStore } from '../src/credential-store.js';

class FakeKeyring {
  readonly credentials = new Map<string, string>();
  readonly accountRequests: string[] = [];
  readonly readErrors = new Map<string, Error>();
  readError: Error | undefined;
  writeError: Error | undefined;
  removeError: Error | undefined;

  forAccount = (account: string): CredentialStore => {
    this.accountRequests.push(account);
    return {
      read: async () => {
        if (this.readError) throw this.readError;
        const failure = this.readErrors.get(account);
        if (failure) throw failure;
        return this.credentials.get(account) ?? null;
      },
      write: async token => {
        if (this.writeError) throw this.writeError;
        this.credentials.set(account, token);
      },
      remove: async () => {
        if (this.removeError) throw this.removeError;
        this.credentials.delete(account);
      },
    };
  };

  projects(directory: string): KeyringProjectStore {
    return new KeyringProjectStore({ credentialFactory: this.forAccount, directory });
  }
}

async function fixture(context: TestContext) {
  const temporary = tmpdir();
  const prefix = join(temporary, 'hetzner-project-store-');
  const root = await mkdtemp(prefix);
  const directory = join(root, 'projects');
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const keyring = new FakeKeyring();
  const projects = keyring.projects(directory);
  return { root, directory, keyring, projects };
}

function encodedAccount(name: string): string {
  const bytes = Buffer.from(name, 'utf8');
  const encoded = bytes.toString('hex');
  return `project-v1-${encoded}`;
}

async function register(directory: string, account: string): Promise<void> {
  const path = join(directory, account);
  await mkdir(path, { recursive: true, mode: 0o700 });
}

test('project names normalize whitespace, Unicode and only the built-in Default casing', () => {
  const cases = [
    ['  Production  ', 'Production'],
    [' Cafe\u0301 ', 'Café'],
    ['default', 'Default'],
    ['DeFaUlT', 'Default'],
    ['Staging', 'Staging'],
    ['staging', 'staging'],
    ['../customer / prod:west\\api', '../customer / prod:west\\api'],
  ];
  for (const [input, expected] of cases) {
    const normalized = normalizeProjectName(input);
    assert.equal(normalized, expected);
  }
  const maximum = '🚀'.repeat(30);
  const validMaximum = normalizeProjectName(maximum);
  assert.equal(validMaximum, maximum);
  const tooLong = '🚀'.repeat(31);
  const invalidMaximum = normalizeProjectName(tooLong);
  assert.equal(invalidMaximum, null);
});

test('invalid project names are rejected without accepting controls or malformed Unicode', async context => {
  const values = [undefined, null, 1, {}, [], '', '   ', 'A\nB', '\tName', 'Name\u0000', 'Name\u007f', 'Name\u009f', '\ud800'];
  for (const value of values) {
    const normalized = normalizeProjectName(value);
    assert.equal(normalized, null);
  }
  const { keyring, projects } = await fixture(context);
  assert.throws(() => projects.forProject(''), /1–30 characters/);
  assert.deepEqual(keyring.accountRequests, []);
});

test('the existing credential remains the canonical Default without migration or fallback', async context => {
  const { directory, keyring, projects } = await fixture(context);
  keyring.credentials.set('default-project', 'existing-default-token');
  const initial = await projects.list();
  assert.deepEqual(initial, ['Default']);
  const current = projects.forProject('DEFAULT');
  const token = await current.read();
  assert.equal(token, 'existing-default-token');
  const unconnected = projects.forProject('Unconnected');
  const missing = await unconnected.read();
  assert.equal(missing, null);
  const stillDefault = keyring.credentials.get('default-project');
  assert.equal(stillDefault, 'existing-default-token');
  await current.write('replacement-default-token');
  const replaced = keyring.credentials.get('default-project');
  assert.equal(replaced, 'replacement-default-token');
  const metadataRead = readdir(directory);
  await assert.rejects(metadataRead, { code: 'ENOENT' });
});

test('named projects keep independent tokens across instances and concurrent registration', async context => {
  const { directory, keyring, projects } = await fixture(context);
  const otherInstance = keyring.projects(directory);
  const production = projects.forProject('Production');
  const staging = otherInstance.forProject('Staging');
  const lowerCase = projects.forProject('staging');
  const productionWrite = production.write('production-token');
  const stagingWrite = staging.write('staging-token');
  await Promise.all([productionWrite, stagingWrite]);
  await lowerCase.write('lower-case-token');
  const connected = await otherInstance.list();
  assert.deepEqual(connected, ['Production', 'Staging', 'staging']);
  const productionAgain = otherInstance.forProject('Production');
  const saved = await productionAgain.read();
  assert.equal(saved, 'production-token');
  await staging.remove();
  const remaining = await otherInstance.list();
  assert.deepEqual(remaining, ['Production', 'staging']);
  const unaffected = await lowerCase.read();
  assert.equal(unaffected, 'lower-case-token');
  const defaultToken = keyring.credentials.get('default-project');
  assert.equal(defaultToken, undefined);
});

test('project registry contains only empty canonical directories, never token contents', async context => {
  const { directory, keyring, projects } = await fixture(context);
  const project = projects.forProject('  Cafe\u0301  ');
  await project.write('private-project-token');
  const expectedAccount = encodedAccount('Café');
  const accountNames = [...keyring.credentials.keys()];
  assert.deepEqual(accountNames, [expectedAccount]);
  const sameProject = projects.forProject('Café');
  const token = await sameProject.read();
  assert.equal(token, 'private-project-token');
  const names = await projects.list();
  assert.deepEqual(names, ['Café']);
  const entries = await readdir(directory);
  assert.deepEqual(entries, [expectedAccount]);
  const aliasPath = join(directory, expectedAccount);
  const contents = await readdir(aliasPath);
  assert.deepEqual(contents, []);
  const unix = process.platform === 'darwin' || process.platform === 'linux';
  if (unix) {
    const info = await stat(directory);
    const permission = info.mode & 0o777;
    assert.equal(permission, 0o700);
  }
  const serialized = JSON.stringify({ names, entries, contents });
  const leaked = serialized.includes('private-project-token');
  assert.equal(leaked, false);
});

test('maximum-length Unicode aliases fit a directory component and encode case-sensitive names distinctly', async context => {
  const { directory, projects } = await fixture(context);
  const name = '🚀'.repeat(30);
  const project = projects.forProject(name);
  await project.write('maximum-length-token');
  const entries = await readdir(directory);
  assert.equal(entries.length, 1);
  const account = entries[0];
  assert.ok(account);
  assert.equal(account.length, 251);
  assert.match(account, /^project-v1-[0-9a-f]+$/);
  const names = await projects.list();
  assert.deepEqual(names, [name]);
  const first = encodedAccount('ࠀ');
  const second = encodedAccount('ࠚ');
  const firstCaseFolded = first.toLowerCase();
  const secondCaseFolded = second.toLowerCase();
  assert.notEqual(firstCaseFolded, secondCaseFolded);
});

test('listing ignores malformed directories, files, symlinks and aliases without a token', async context => {
  const { root, directory, keyring, projects } = await fixture(context);
  keyring.credentials.set('default-project', 'default-token');
  const valid = encodedAccount('Alpha');
  await register(directory, valid);
  keyring.credentials.set(valid, 'alpha-token');
  const empty = encodedAccount('Empty');
  await register(directory, empty);
  keyring.credentials.set(empty, '');
  const absent = encodedAccount('Absent');
  await register(directory, absent);
  for (const invalid of ['Default', ' Alpha ', 'Cafe\u0301']) {
    const account = encodedAccount(invalid);
    await register(directory, account);
    keyring.credentials.set(account, 'invalid-alias-token');
  }
  await register(directory, `${valid}=`);
  await register(directory, 'unknown-account');
  await register(directory, 'project-v1-%%%invalid');
  const fileAccount = encodedAccount('File');
  const filePath = join(directory, fileAccount);
  await writeFile(filePath, '');
  keyring.credentials.set(fileAccount, 'file-token');
  const symlinkAccount = encodedAccount('Link');
  const linkPath = join(directory, symlinkAccount);
  await symlink(root, linkPath, 'dir');
  keyring.credentials.set(symlinkAccount, 'link-token');
  const names = await projects.list();
  assert.deepEqual(names, ['Default', 'Alpha']);
});

test('a failed token write leaves a discoverable empty alias that is filtered from connected projects', async context => {
  const { directory, keyring, projects } = await fixture(context);
  const credential = projects.forProject('Retry later');
  const failure = new Error('keychain locked');
  keyring.writeError = failure;
  const saving = credential.write('private-token');
  await assert.rejects(saving, failure);
  const expectedAccount = encodedAccount('Retry later');
  const entries = await readdir(directory);
  assert.deepEqual(entries, [expectedAccount]);
  const connected = await projects.list();
  assert.deepEqual(connected, []);
  keyring.writeError = undefined;
  await credential.write('saved-after-unlock');
  const ready = await projects.list();
  assert.deepEqual(ready, ['Retry later']);
});

test('registry failures prevent token writes and propagate instead of hiding existing projects', async context => {
  const { directory, keyring, projects } = await fixture(context);
  await writeFile(directory, 'not a directory');
  const credential = projects.forProject('Selected');
  const saving = credential.write('private-token');
  await assert.rejects(saving);
  assert.equal(keyring.credentials.size, 0);
  const listing = projects.list();
  await assert.rejects(listing);
});

test('an unreadable project does not produce a misleading sole-project list', async context => {
  const { keyring, projects } = await fixture(context);
  const first = projects.forProject('Production');
  const second = projects.forProject('Staging');
  await first.write('production-token');
  await second.write('staging-token');
  const failure = new Error('credential access denied');
  const account = encodedAccount('Production');
  keyring.readErrors.set(account, failure);
  const listing = projects.list();
  await assert.rejects(listing, failure);
});

test('credential failures propagate without selecting another project', async context => {
  const { keyring, projects } = await fixture(context);
  const credential = projects.forProject('Selected');
  const failure = new Error('keychain unavailable');
  keyring.readError = failure;
  const reading = credential.read();
  await assert.rejects(reading, failure);
  keyring.writeError = failure;
  const writing = credential.write('private-token');
  await assert.rejects(writing, failure);
  keyring.removeError = failure;
  const removing = credential.remove();
  await assert.rejects(removing, failure);
  assert.equal(keyring.credentials.size, 0);
});
