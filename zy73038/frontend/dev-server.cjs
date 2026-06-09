const esbuild = require('esbuild');
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');

const app = express();
const PORT = 5173;
const OUT = path.join(__dirname, '.tmp_dist');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function build() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/main.jsx')],
    bundle: true,
    sourcemap: true,
    outdir: OUT,
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    jsx: 'automatic',
    platform: 'browser',
    format: 'esm',
    target: 'es2020',
    logLevel: 'error',
    banner: { js: '// auto-bundled' },
  });
}

app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
}));

app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(express.static(OUT));
app.get('/', (req, res, next) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get(/\/.+/, (req, res, next) => {
  const f = path.join(OUT, req.path);
  if (fs.existsSync(f)) return res.sendFile(f);
  res.sendFile(path.join(__dirname, 'index.html'));
});

(async () => {
  console.log('🔨 正在构建前端代码…');
  try {
    await build();
    console.log('✅ 构建完成');
  } catch (e) {
    console.error('❌ 构建失败:', e.message || e);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`✅ 前端服务已启动: http://localhost:${PORT}`);
  });

  let debounce = null;
  fs.watch(path.join(__dirname, 'src'), { recursive: true }, () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      try {
        const start = Date.now();
        await build();
        console.log(`🔄 代码变更，重建完成 (${Date.now() - start}ms)`);
      } catch (e) {
        console.error('❌ 重建失败:', e.message);
      }
    }, 300);
  });
})();
