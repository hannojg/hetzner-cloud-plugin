import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export async function openBrowser(url: string): Promise<void> {
  if (process.platform === 'darwin') {
    await run('open', [url], { timeout: 5000 });
  } else if (process.platform === 'win32') {
    await run('rundll32.exe', ['url.dll,FileProtocolHandler', url], { timeout: 5000 });
  } else if (process.platform === 'linux') {
    await run('xdg-open', [url], { timeout: 5000 });
  } else {
    throw new Error('This operating system is not supported.');
  }
}
