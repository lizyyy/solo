#!/usr/bin/env node
// 修复 macOS arm64 + Node 24 下 rollup 原生二进制签名不匹配、无法 dlopen 的问题。
// 策略：将 rollup/dist/native.js 整体替换为一个带 fallback 的 shim：
//       先尝试加载原生绑定，失败则 fallback 到 @rollup/wasm-node 的 WASM 版。
// 幂等：已替换过则跳过。

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const TARGET = join(root, 'node_modules', 'rollup', 'dist', 'native.js');
const BACKUP = join(root, 'node_modules', 'rollup', 'dist', 'native.js.orig');
const WASM_NATIVE = join(root, 'node_modules', '@rollup', 'wasm-node', 'dist', 'native.js');
const MARKER = '/* [shim] wasm-fallback for rollup native binding */';

if (!existsSync(TARGET)) {
  console.log('[patch-rollup] rollup native not found, skip');
  process.exit(0);
}

const current = readFileSync(TARGET, 'utf8');
if (current.includes(MARKER)) {
  console.log('[patch-rollup] already patched, skip');
  process.exit(0);
}

// 备份原文件（第一次 patch 时）
if (!existsSync(BACKUP)) {
  copyFileSync(TARGET, BACKUP);
}

// 生成 shim：先试原生 require，失败 fallback 到 wasm
const shim = `'use strict';
${MARKER}
// 本文件由 scripts/patch-rollup.mjs 自动生成
// 优先使用原生 rollup 绑定，失败（如签名不兼容）时降级到 @rollup/wasm-node
const path = require('path');
const fs = require('fs');

const ORIG_NATIVE = path.join(__dirname, 'native.js.orig');
const WASM_NATIVE = path.resolve(__dirname, '..', '..', '@rollup', 'wasm-node', 'dist', 'native.js');

function loadNative() {
  if (fs.existsSync(ORIG_NATIVE)) {
    try {
      return require(ORIG_NATIVE);
    } catch (_e) {
      // ignore and fall through
    }
  }
  if (fs.existsSync(WASM_NATIVE)) {
    return require(WASM_NATIVE);
  }
  throw new Error('No rollup native binding available');
}

const mod = loadNative();

module.exports.parse = mod.parse;
module.exports.parseAsync = mod.parseAsync;
module.exports.xxhashBase64Url = mod.xxhashBase64Url;
module.exports.xxhashBase36 = mod.xxhashBase36;
module.exports.xxhashBase16 = mod.xxhashBase16;

// 兼容 ESM 命名导入可能用到的 __esModule 标记
Object.defineProperty(module.exports, '__esModule', { value: true });
`;

writeFileSync(TARGET, shim, 'utf8');
console.log('[patch-rollup] patched rollup native binding with wasm fallback');

// 额外：es 目录下也可能有引用
const esTarget = join(root, 'node_modules', 'rollup', 'dist', 'es', 'shared', 'parseAst.js');
// （vite 的 import-analysis 走的是 CJS 路径的 rollup/dist/native.js，es 路径暂时不用管）

process.exit(0);
