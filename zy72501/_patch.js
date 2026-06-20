var fs = require('fs');
var c = fs.readFileSync('src/inspectionEngine.js.bak', 'utf8');
console.log('原始文件:', c.length, '字节');

// Step A: 删除简单的 /\bRAG\b/i 避免误匹配
var beforeA = c.length;
c = c.replace('    /\\bRAG\\b/i,\n', '');
console.log('Step A 删除 /\\bRAG\\b/i:', beforeA, '→', c.length);

// Step B: 在模块顶部插入全局辅助（紧接在 PHONE_REGEX 行之后）
var markerB = 'const PHONE_REGEX = /1[3-9]\\d{9}/g;\n';
var insertB = markerB + [
  '',
  'var RAG_PATTERNS = [',
  '  /RAG[ _-]*(引用|证据|来源|出处|reference|cite)/i,',
  '  /(引用|证据|来源|出处)[ _-]*RAG/i,',
  '  /知识库第[^\\s]+节/,',
  '  /引用来源[：:]/,',
  '  /RAG[ _-]*reference/i,',
  '  /\\*RAG\\*/,',
  '  /【RAG[ _-]*(引用|证据|来源|出处)】/,',
  '  /「RAG[ _-]*(引用|证据|来源|出处)」/,',
  '  /RAG[ _-]*引用[ _-]*来源/i,',
  '  /(引用|证据|来源|出处)[ _-]*\\[RAG\\]/i',
  '];',
  '',
  'var NEG_PREFIX = [\'缺少\',\'缺失\',\'未标注\',\'未添加\',\'未填写\',\'无\',\'没有\',\'待补充\',\'尚未\',\'暂未\',\'待补\',\'需补充\',\'未找到\',\'未附上\',\'未提供\',\'缺乏\',\'未包含\',\'未说明\'];',
  'var NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];',
  '',
  'function isNegatedRagMatch(mt, ft, mi) {',
  '  var pfx = ft.substring(Math.max(0, mi - 24), mi);',
  '  for (var i = 0; i < NEG_PREFIX.length; i++) {',
  '    if (pfx.indexOf(NEG_PREFIX[i]) >= 0) return {negated:true, reason:\'前缀含「\' + NEG_PREFIX[i] + \'」\'};',
  '  }',
  '  var sfx = ft.substring(mi + mt.length, Math.min(ft.length, mi + mt.length + 24));',
  '  for (var j = 0; j < NEG_SUFFIX.length; j++) {',
  '    if (NEG_SUFFIX[j].test(sfx)) return {negated:true, reason:\'后缀匹配「\' + NEG_SUFFIX[j].toString() + \'」\'};',
  '  }',
  '  return {negated:false};',
  '}',
  '',
  'function findValidRagMatches(text) {',
  '  var valid = [], neg = [];',
  '  if (!text) return {validMatches:valid, negatedMatches:neg};',
  '  for (var pi = 0; pi < RAG_PATTERNS.length; pi++) {',
  '    var pat = RAG_PATTERNS[pi];',
  '    var re = new RegExp(pat.source, pat.flags.indexOf(\'g\') >= 0 ? pat.flags : pat.flags + \'g\');',
  '    var m;',
  '    while ((m = re.exec(text)) !== null) {',
  '      var base = {patternIndex:pi, matchedText:m[0], matchIndex:m.index, context:getMatchContext(text, m.index, m[0].length)};',
  '      var ck = isNegatedRagMatch(m[0], text, m.index);',
  '      if (ck.negated) { base.negationReason = ck.reason; neg.push(base); } else { valid.push(base); }',
  '      if (m.index === re.lastIndex) re.lastIndex++;',
  '    }',
  '  }',
  '  return {validMatches:valid, negatedMatches:neg};',
  '}',
  ''
].join('\n');

if (c.indexOf(markerB) >= 0) {
  c = c.replace(markerB, insertB);
  console.log('Step B 插入全局辅助: OK');
} else {
  console.log('Step B 失败: 找不到 markerB');
}

fs.writeFileSync('src/inspectionEngine.js', c, 'utf8');
console.log('写入:', c.length, '字节');
