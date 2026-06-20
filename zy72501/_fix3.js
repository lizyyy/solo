const fs = require('fs');
const p = 'src/inspectionEngine.js';
let c = fs.readFileSync(p, 'utf8');

// 现在文件里是 /\\*RAG\\*/  (双反斜杠)
// 需要改成 /\*RAG\*/  (单反斜杠)
// 在JS字符串中: \\\\ 表示 \\ 字符, \\ 表示 \ 字符
c = c.replace('/\\\\\\\\*RAG\\\\\\\\*/,', '/\\\\*RAG\\\\*/,');

fs.writeFileSync(p, c);
console.log('Fixed3');
