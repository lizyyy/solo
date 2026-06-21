import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform, arch } from 'node:os';
import { resolve } from 'node:path';

if (platform() === 'darwin' && arch() === 'arm64') {
  const candidates = [
    'node_modules/@rollup/rollup-darwin-arm64/rollup.darwin-arm64.node',
    'node_modules/rollup/dist/native.js',
  ];
  for (const rel of candidates) {
    const abs = resolve(process.cwd(), rel);
    if (existsSync(abs)) {
      try {
        execSync(`codesign --force -s - "${abs}"`, { stdio: 'ignore' });
        console.log(`[fix-rollup] ad-hoc signed: ${rel}`);
      } catch {
        console.log(`[fix-rollup] skip (codesign failed): ${rel}`);
      }
    }
  }
}
