import { fileURLToPath } from 'node:url';
import { KeyringProjectStore } from './project-store.js';
import { runClient } from './client.js';
import { launchSetup } from './setup-launcher.js';
import { startSetup } from './setup-server.js';
import { openBrowser } from './browser.js';

async function setupServer(): Promise<void> {
  const projects = new KeyringProjectStore();
  const session = await startSetup({ projects });
  try {
    await openBrowser(session.url);
    process.send?.({ url: session.url, expiresAt: session.expiresAt });
  } catch {
    await session.close();
    process.send?.({ error: 'setup_unavailable' });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === '_setup-server') {
    await setupServer();
    return;
  }
  const projects = new KeyringProjectStore();
  let input: string | undefined;
  if (args[0] === 'call' && process.stdin.isTTY !== true) {
    const buffers: Buffer[] = [];
    for await (const chunk of process.stdin) {
      const buffer: Buffer = chunk;
      buffers.push(buffer);
    }
    const bytes = Buffer.concat(buffers);
    input = bytes.toString('utf8');
  }
  const entrypoint = fileURLToPath(import.meta.url);
  async function setup() {
    return launchSetup(entrypoint);
  }
  const result = await runClient(args, { projects, input, setup });
  const json = JSON.stringify(result.payload);
  process.stdout.write(`${json}\n`);
  process.exitCode = result.isError ? 1 : 0;
}

try {
  await main();
} catch {
  const json = JSON.stringify({ error: { code: 'client_failed', message: 'The local Hetzner client could not complete this command.' } });
  process.stdout.write(`${json}\n`);
  process.exitCode = 1;
}
