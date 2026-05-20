const fs = require('fs');

const rawData = fs.readFileSync(0, 'utf-8');
const data = JSON.parse(rawData);

console.log('=== 处理摘要 ===');
console.log('批次ID:', data.batchId);
console.log('是否重复批次:', data.isDuplicateBatch);
console.log('');
console.log('统计:', JSON.stringify(data.result.summary));
console.log('');

console.log('=== 成功 (success):', data.result.success.length);
data.result.success.forEach(r => console.log('  ✅ ' + r.childName + ' - ' + r.vaccineName));
console.log('');

console.log('=== 缺苗候补 (waitlist):', data.result.waitlist.length);
data.result.waitlist.forEach(r => {
  console.log('  ⏳ ' + r.childName + ' - ' + r.vaccineName);
  console.log('     原因: ' + r.processingResult.issues.map(i => i.message).join('; '));
});
console.log('');

console.log('=== 待确认 (needsConfirmation):', data.result.needsConfirmation.length);
data.result.needsConfirmation.forEach(r => {
  console.log('  ⚠️  ' + r.childName + ' - ' + r.vaccineName);
  console.log('     原因: ' + r.processingResult.issues.map(i => i.message).join('; '));
});
console.log('');

console.log('=== 失败 (failed):', data.result.failed.length);
data.result.failed.forEach(r => {
  console.log('  ❌ ' + r.childName + ' - ' + r.vaccineName);
  console.log('     原因: ' + r.processingResult.issues.map(i => i.message).join('; '));
  console.log('     建议: ' + r.processingResult.suggestions.join('; '));
});
console.log('');

console.log('=== 解析错误 (parseErrors):', data.result.parseErrors.length);
data.result.parseErrors.forEach(e => console.log('  行' + e.row + ': ' + e.error));
