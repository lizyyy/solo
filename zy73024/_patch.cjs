const path = require('node:path');
let parseModule, baseModule;
try { parseModule = require(path.join(__dirname, '../..', '@rollup/wasm-node/dist/shared/parseAst.js')); }
catch (e) { parseModule = require('@rollup/wasm-node/dist/shared/parseAst.js'); }
try { baseModule = require(path.join(__dirname, '../..', '@rollup/wasm-node/dist/shared/index.js')); }
catch (e) { try { baseModule = require('@rollup/wasm-node/dist/shared/index.js'); } catch (e2) { baseModule = {}; } }
const { parse, parseAsync } = parseModule;
const NOOP = function () { return ''; };
const xxhashBase64Url = baseModule.xxhashBase64Url || NOOP;
const xxhashBase36  = baseModule.xxhashBase36  || NOOP;
const xxhashBase16  = baseModule.xxhashBase16  || NOOP;
module.exports = { parse, parseAsync, xxhashBase64Url, xxhashBase36, xxhashBase16 };
