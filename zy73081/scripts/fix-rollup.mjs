import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const rollupNativePath = resolve(root, 'node_modules/rollup/dist/native.js');
const wasmNativePath = resolve(root, 'node_modules/@rollup/wasm-node/dist/native.js');

if (!existsSync(rollupNativePath)) {
  console.log('[fix-rollup] rollup native.js not found, skip');
  process.exit(0);
}

if (!existsSync(wasmNativePath)) {
  console.log('[fix-rollup] @rollup/wasm-node not installed, skip');
  process.exit(0);
}

const current = readFileSync(rollupNativePath, 'utf-8');
const marker = '// patched: use wasm rollup native for Node >= 24';

if (current.includes(marker)) {
  console.log('[fix-rollup] already patched');
  process.exit(0);
}

const require = createRequire(import.meta.url);
const wasmNative = require(wasmNativePath);
const exportNames = Object.keys(wasmNative);

const lines = [
  marker,
  `import { createRequire } from 'node:module';`,
  `const require = createRequire(import.meta.url);`,
  `const native = require('@rollup/wasm-node/dist/native.js');`,
  ...exportNames.map((n) => `export const ${n} = native.${n};`),
  '',
];

mkdirSync(dirname(rollupNativePath), { recursive: true });
writeFileSync(rollupNativePath, lines.join('\n'), 'utf-8');
console.log(`[fix-rollup] patched native.js (${exportNames.join(', ')})`);
