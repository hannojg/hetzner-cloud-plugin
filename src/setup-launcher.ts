import { spawn } from 'node:child_process';

interface SetupLocation {
  url: string;
  expiresAt: string;
}

function isSetupLocation(value: unknown): value is SetupLocation {
  if (value === null || typeof value !== 'object') return false;
  return 'url' in value && typeof value.url === 'string' && 'expiresAt' in value && typeof value.expiresAt === 'string';
}

export function launchSetup(entrypoint: string): Promise<SetupLocation> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, '_setup-server'], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      windowsHide: true,
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('The private setup page did not start.'));
    }, 10_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('The private setup process stopped before opening its page.'));
    });
    child.once('message', (message) => {
      clearTimeout(timeout);
      const valid = isSetupLocation(message);
      if (valid === false) {
        child.kill();
        reject(new Error('The private setup page could not be opened.'));
        return;
      }
      child.disconnect();
      child.unref();
      resolve(message);
    });
  });
}
