const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST = path.resolve(__dirname, 'dist');
const SRC = path.resolve(__dirname, 'src');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

execSync('npx tailwindcss -i src/index.css -o dist/index.css --minify', {
  cwd: __dirname,
  stdio: 'inherit',
});

esbuild.build({
  entryPoints: [path.join(SRC, 'main.tsx')],
  bundle: true,
  outfile: path.join(DIST, 'main.js'),
  minify: false,
  sourcemap: true,
  jsx: 'automatic',
  target: 'es2020',
  format: 'esm',
  platform: 'browser',
  logLevel: 'info',
  loader: {
    '.svg': 'dataurl',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.gif': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.ttf': 'dataurl',
    '.eot': 'dataurl',
    '.glb': 'file',
    '.gltf': 'file',
    '.wasm': 'file',
  },
  alias: {
    '@': SRC,
  },
  define: {
    'process.env.NODE_ENV': '"development"',
    'import.meta.env.VITE_USE_MOCK': '"true"',
  },
}).then(() => {
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>消防分区方案比选 · Web3D 审图台</title>
    <link rel="stylesheet" href="/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>`;
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  console.log('\n[build] dist/ ready');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
