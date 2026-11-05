import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const rootUrl = new URL('../', import.meta.url);
const root = fileURLToPath(rootUrl);
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/index.ts'],
  outfile: 'plugins/hetzner-cloud/dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  minify: true,
  legalComments: 'linked',
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  write: false,
});
const check = process.argv.includes('--check');
for (const file of result.outputFiles) {
  if (check) {
    const committed = await readFile(file.path);
    const expected = Buffer.from(file.contents);
    if (committed.equals(expected) === false) {
      throw new Error(`Bundle is out of date: ${file.path}. Run npm run build.`);
    }
  } else {
    const directory = dirname(file.path);
    await mkdir(directory, { recursive: true });
    await writeFile(file.path, file.contents);
  }
}
console.log(check ? 'Committed MCP bundle is current.' : 'Built standalone MCP bundle.');
