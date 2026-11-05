import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { verifyNativeArtifacts } from './vendor-keyring.mjs';

const rootUrl = new URL('../', import.meta.url);
const root = fileURLToPath(rootUrl);
await verifyNativeArtifacts();
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/index.ts'],
  outfile: 'plugins/hetzner-cloud/dist/client.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  minify: true,
  legalComments: 'linked',
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  write: false,
  plugins: [{
    name: 'bundled-native-keyring',
    setup(context) {
      context.onResolve({ filter: /^@napi-rs\/keyring$/ }, () => ({
        path: './native/keyring.cjs',
        external: true,
      }));
    },
  }],
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
console.log(check ? 'Committed client bundle is current.' : 'Built standalone local client.');
