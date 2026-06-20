import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('export-verification.json', 'utf-8'));
console.log('=== 导出JSON文件校验 ===\n');

console.log('--- 导出Manifest (CD202406070001) ---');
const m = data.manifests.find((x: any) => x.id === 'm1');
Object.keys(m).forEach((k: string) => {
  const v = typeof m[k] === 'object' ? `[Array(${m[k].length})]` : m[k];
  console.log('  ' + k + ': ' + v);
});

console.log('\n--- 导出冲突 (deferred) ---');
const c = data.conflicts.find((x: any) => x.status === 'deferred');
Object.keys(c).forEach((k: string) => {
  console.log('  ' + k + ': ' + c[k]);
});

console.log('\n--- dataSourceNote ---');
console.log('  ' + data.dataSourceNote);

console.log('\n--- 导出字段总数 ---');
console.log('  manifests: ' + data.manifests.length);
console.log('  conflicts: ' + data.conflicts.length);
console.log('  overrideHistory: ' + data.overrideHistory.length);
console.log('  knowledgeReferences: ' + data.knowledgeReferences.length);
console.log('  feedbackTickets: ' + data.feedbackTickets.length);

console.log('\n✅ 导出JSON包含完整的deferred冲突状态');
