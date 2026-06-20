#!/usr/bin/env node
/**
 * 消防分区图纸复核 · 启动前环境检查
 * 确保两件事：
 *   1. @rollup/wasm-node 已安装（被 rollup patch 桥接依赖）
 *   2. rollup 的 native.js 确实被 patch 成 WASM 桥接版本
 * 如果不满足，会给出明确的修复指引，而不是运行时抛神秘签名错误。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function colorize(msg, code) {
  return `\x1b[${code}m${msg}\x1b[0m`;
}

const info = (m) => console.log(colorize(`[fire-review] ${m}`, '36'));
const ok = (m) => console.log(colorize(`[fire-review] ✓ ${m}`, '32'));
const warn = (m) => console.log(colorize(`[fire-review] ⚠ ${m}`, '33'));
const fail = (m) => console.error(colorize(`[fire-review] ✗ ${m}`, '31'));

let okCount = 0;
let failCount = 0;

// --- Check 1: Node 版本建议范围 ---
const nodeVer = process.versions.node;
const [major] = nodeVer.split('.').map(Number);
info(`当前 Node 版本: v${nodeVer}`);
if (major >= 18 && major < 27) {
  ok(`Node 主版本 ${major} 在兼容范围 [18, 20, 22, 24, 25, 26]`);
  okCount++;
} else {
  warn(`Node 主版本 ${major} 超出建议范围，可能出现兼容问题（建议 v18 / v20 LTS / v22 LTS）`);
}

// --- Check 2: @rollup/wasm-node 是否安装 ---
const wasmNodePkgPath = path.join(
  projectRoot,
  'node_modules',
  '@rollup',
  'wasm-node',
  'package.json'
);
if (fs.existsSync(wasmNodePkgPath)) {
  const wasmNodeVer = JSON.parse(fs.readFileSync(wasmNodePkgPath, 'utf8')).version;
  ok(`@rollup/wasm-node 已安装，版本: ${wasmNodeVer}`);
  okCount++;
} else {
  fail('@rollup/wasm-node 未安装，请先执行：pnpm install');
  failCount++;
}

// --- Check 3: rollup/dist/native.js 是否已被 patch 为 WASM 桥接 ---
const rollupNativeJsPath = (() => {
  const candidates = [
    path.join(projectRoot, 'node_modules', 'rollup', 'dist', 'native.js'),
    path.join(projectRoot, 'node_modules', '.pnpm', 'rollup@4.61.1', 'node_modules', 'rollup', 'dist', 'native.js'),
  ];
  // 全局搜索 .pnpm 下任意 rollup@4.x 的 native.js
  try {
    const pnpmDir = path.join(projectRoot, 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      for (const d of fs.readdirSync(pnpmDir)) {
        if (d.startsWith('rollup@4.')) {
          const p = path.join(pnpmDir, d, 'node_modules', 'rollup', 'dist', 'native.js');
          if (fs.existsSync(p)) candidates.push(p);
        }
      }
    }
  } catch (_) {
    /* ignore */
  }
  return candidates.find((p) => fs.existsSync(p)) || null;
})();

if (rollupNativeJsPath) {
  const content = fs.readFileSync(rollupNativeJsPath, 'utf8');
  if (content.includes('@rollup/wasm-node/dist/wasm-node/bindings_wasm.js')) {
    ok('rollup/dist/native.js 已正确 patch 为 WASM 桥接版本');
    okCount++;
  } else {
    fail('rollup/dist/native.js 仍是原生二进制加载版本，patch 未生效！');
    fail('  → 请执行：rm -rf node_modules pnpm-lock.yaml && pnpm install');
    failCount++;
  }
} else {
  warn('未找到 rollup/dist/native.js（首次安装中属正常），执行 pnpm install 后可再次检查');
}

console.log('');
info(`检查完成：${okCount} 项通过，${failCount} 项失败`);

if (failCount > 0) {
  console.error(colorize('\n启动被终止，请先解决上方失败项后重试\n', '31'));
  process.exit(1);
}

ok('环境检查全部通过，可以执行 pnpm dev / pnpm build');
process.exit(0);
