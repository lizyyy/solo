// node scripts/apply-rollup-patch.cjs
// 在 npm install 之后自动执行，用项目内固化的替代文件覆盖 node_modules/rollup/dist/native.js
// 解决 macOS arm64 / 新版 Node 下 rollup 原生二进制签名校验失败 (ERR_DLOPEN_FAILED / MODULE_NOT_FOUND)

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const target = path.join(projectRoot, 'node_modules', 'rollup', 'dist', 'native.js');
const source = path.join(projectRoot, 'scripts', 'rollup-native-patch.js');

if (!fs.existsSync(source)) {
  console.error('[rollup-patch] 源文件不存在: ' + source);
  process.exit(1);
}

if (!fs.existsSync(target)) {
  // 某些 npm 版本 / 环境下 rollup 的 dist/native.js 可能没生成，创建父目录兜底
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
}

fs.copyFileSync(source, target);
console.log('[rollup-patch] 已覆盖 ' + path.relative(projectRoot, target) + ' → 使用 @rollup/wasm-node 的 WASM bindings');
