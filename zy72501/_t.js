require('./test_full_verify.js');
var text = '现场说法：2024-Q2第二批灰度测试，客户咨询退款进度，坐席手动记录的手机号 13900139000 未自动遮蔽。此批次的RAG引用待补充。 RAG引用来源：知识库第5.7节灰度二期现场规范';
var result = global.findValidRagMatches(text);
console.log('有效匹配:', result.validMatches.length);
console.log('否定匹配:', result.negatedMatches.length);
result.validMatches.forEach(function(v, i) {
  console.log('  有效' + (i+1) + ': [' + v.matchedText + '] at ' + v.matchIndex);
});
result.negatedMatches.forEach(function(v, i) {
  console.log('  否定' + (i+1) + ': [' + v.matchedText + '] at ' + v.matchIndex + ' 原因: ' + v.negationReason);
});
