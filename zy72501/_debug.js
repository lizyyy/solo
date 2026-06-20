const ie = require('./src/inspectionEngine');
const findValidRagMatches = ie.findValidRagMatches;

var ns = '现场说法：2024-Q2第二批灰度测试，客户咨询退款进度，坐席手动记录的手机号 13900139000 未自动遮蔽。此批次的RAG引用待补充。 RAG引用来源：知识库第5.7节灰度二期现场规范';
console.log('Text length:', ns.length);

var result = findValidRagMatches(ns);
console.log('Valid matches:', result.validMatches.length);
result.validMatches.forEach(function(m, i) {
  console.log('  Valid[' + i + ']:', JSON.stringify(m.matchedText), 'at', m.matchIndex);
});
console.log('Negated matches:', result.negatedMatches.length);
result.negatedMatches.forEach(function(m, i) {
  console.log('  Negated[' + i + ']:', JSON.stringify(m.matchedText), 'at', m.matchIndex, 'reason:', m.negationReason);
  var pfxStart = Math.max(0, m.matchIndex - 24);
  console.log('    prefix-24:', JSON.stringify(ns.substring(pfxStart, m.matchIndex)));
  var sfxStart = m.matchIndex + m.matchedText.length;
  console.log('    suffix-24:', JSON.stringify(ns.substring(sfxStart, sfxStart + 24)));
});
