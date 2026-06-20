// 固化在项目仓库里的 rollup native bindings patch
// 将 node_modules/rollup/dist/native.js 的原生二进制加载回退到 @rollup/wasm-node 的 WASM 实现
// 顶层静态 exports.* 形式，保证 Node 的 CJS→ESM interop 能识别 parse/parseAsync/xxhash* 命名导出

var _wasm = require('@rollup/wasm-node/dist/native.js');
exports.parse = _wasm.parse;
exports.parseAsync = _wasm.parseAsync;
exports.xxhashBase64Url = _wasm.xxhashBase64Url;
exports.xxhashBase36 = _wasm.xxhashBase36;
exports.xxhashBase16 = _wasm.xxhashBase16;
exports.default = _wasm;
