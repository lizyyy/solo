const fs = require('fs');
const content = fs.readFileSync('src/inspectionEngine.js', 'utf8');

console.log('=== 检查 checkPhoneMasking 结构 ===');
const checkFn = content.match(/function checkPhoneMasking[\s\S]*?return issues;\n\}/);
if (checkFn) {
  const hasPhone = checkFn[0].includes('phone: phone');
  const hasFieldName = checkFn[0].includes('fieldName: extraMeta.fieldName');
  console.log('  has phone field:', hasPhone);
  console.log('  has fieldName at top level:', hasFieldName);
}

console.log('');
console.log('=== 检查 exportResult 是否有 gapsSummary ===');
const hasGapsSummary = content.includes('gapsSummary: gapsSummary');
const hasPhoneSummary = content.includes('phoneIssuesSummary: phoneIssuesSummary');
console.log('  gapsSummary in exportResult:', hasGapsSummary);
console.log('  phoneIssuesSummary in exportResult:', hasPhoneSummary);

console.log('');
console.log('=== 检查 runInspection 中 checkPhoneMasking 调用 ===');
const ruleCalls = content.match(/checkPhoneMasking\(rule\.\w+/g);
const batchCalls = content.match(/checkPhoneMasking\(batch\.\w+/g);
console.log('  rule field calls:', ruleCalls);
console.log('  batch field calls:', batchCalls);

console.log('');
console.log('=== 检查 generateFriendlyReport 标题 ===');
const titleMatch = content.match(/lines\.push\(`📋.*`\)/);
console.log('  report title:', titleMatch ? titleMatch[0] : 'NOT FOUND');

console.log('');
console.log('=== 检查 negatedMatches 显示 ===');
const hasNegDisplay = content.includes('否定表达(被排除关键词)');
console.log('  has 否定表达 display:', hasNegDisplay);

console.log('');
console.log('=== 检查 allPhoneIssues 是 let 还是 const ===');
const letCheck = content.match(/(const|let) allPhoneIssues/);
console.log('  allPhoneIssues declaration:', letCheck ? letCheck[0] : 'NOT FOUND');
