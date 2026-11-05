import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { launchSetup } from '../src/setup-launcher.js';

test('setup launcher returns its private URL while the detached helper keeps running', { timeout: 15000 }, async () => {
  const temporaryRoot = tmpdir();
  const prefix = join(temporaryRoot, 'hetzner-launcher-test-');
  const directory = await mkdtemp(prefix);
  const helper = join(directory, 'helper.mjs');
  const pidFile = join(directory, 'child.pid');
  const source = `import { writeFileSync } from 'node:fs';
if (process.argv[2] !== '_setup-server') process.exit(2);
const pidFile = new URL('./child.pid', import.meta.url);
const pid = String(process.pid);
writeFileSync(pidFile, pid);
process.send?.({ url: 'http://127.0.0.1:12345/private-session', expiresAt: '2026-11-05T12:10:00.000Z' });
setInterval(() => {}, 60000);
`;
  await writeFile(helper, source);
  let processId: number | undefined;
  try {
    const location = await launchSetup(helper);
    assert.deepEqual(location, { url: 'http://127.0.0.1:12345/private-session', expiresAt: '2026-11-05T12:10:00.000Z' });
    const pidText = await readFile(pidFile, 'utf8');
    processId = Number(pidText);
    process.kill(processId, 0);
  } finally {
    if (processId === undefined) {
      try {
        const pidText = await readFile(pidFile, 'utf8');
        processId = Number(pidText);
      } catch {}
    }
    if (processId !== undefined) {
      try {
        process.kill(processId, 'SIGTERM');
      } catch {}
    }
    await rm(directory, { recursive: true, force: true });
  }
});
