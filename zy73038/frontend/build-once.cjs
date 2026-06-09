const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '.tmp_dist');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

esbuild.build({
  entryPoints: [path.join(__dirname, 'src/main.jsx')],
  bundle: true,
  sourcemap: true,
  outdir: OUT,
  loader: { '.jsx': 'jsx', '.js': 'jsx' },
  jsx: 'automatic',
  platform: 'browser',
  format: 'esm',
  target: 'es2020',
  logLevel: 'info',
}).then(() => {
  console.log('BUILD OK. Files in .tmp_dist/:', fs.readdirSync(OUT));
}).catch(e => {
  console.error('BUILD FAILED:', e.message);
  process.exit(1);
});
