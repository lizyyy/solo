const fs = require('fs');
const p = 'src/inspectionEngine.js';
let c = fs.readFileSync(p, 'utf8');

// 修复 [^\\s] 应该是 [^\s]  (正则字面量里单反斜杠)
c = c.replace('[^\\\\s]', '[^\\s]');

// 修复 /\\\\*RAG\\\\*/ 应该是 /\*RAG\*/
c = c.replace('/\\\\\\\\*RAG\\\\\\\\*/,', '/\\*RAG\\*/,');

// 修复 [RAG] 应该是 \[RAG\]
c = c.replace('[ _-]*[RAG]/i', '[ _-]*\\[RAG\\]/i');

fs.writeFileSync(p, c);
console.log('Fixed');
