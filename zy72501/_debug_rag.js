var RAG_PATTERNS = [
  /RAG[ _-]*(引用|证据|来源|出处|reference|cite)/i,
  /(引用|证据|来源|出处)[ _-]*RAG/i,
  /知识库第[^\s]+节/,
  /引用来源[：:]/,
  /RAG[ _-]*reference/i,
  /\*RAG\*/,
  /【RAG[ _-]*(引用|证据|来源|出处)】/,
  /「RAG[ _-]*(引用|证据|来源|出处)」/,
  /RAG[ _-]*引用[ _-]*来源/i,
  /(引用|证据|来源|出处)[ _-]*\[RAG\]/i
];
var NEG_PREFIX = ["不是","并非","非","缺少","缺失","未标注","未添加","未填写","无","没有","待补充","尚未","暂未","待补","需补充","未找到","未附上","未提供","缺乏","未包含","未说明"];
var NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];

function getMatchContext(text, matchIndex, matchLength, contextLen) {
  var CL = contextLen || 30;
  var start = Math.max(0, matchIndex - CL);
  var end = Math.min(text.length, matchIndex + matchLength + CL);
  var p = text.substring(start, matchIndex);
  var s = text.substring(matchIndex + matchLength, end);
  if (start > 0) p = "..." + p;
  if (end < text.length) s = s + "...";
  return {prefix:p, matched:text.substring(matchIndex, matchIndex+matchLength), suffix:s, fullContext:p+text.substring(matchIndex, matchIndex+matchLength)+s};
}

function isNegatedRagMatch(mt, ft, mi) {
  var pfx = ft.substring(Math.max(0, mi - 24), mi);
  console.log("  检查前缀 (24字符): [" + pfx + "]");
  for (var i = 0; i < NEG_PREFIX.length; i++) {
    if (pfx.indexOf(NEG_PREFIX[i]) >= 0) {
      console.log("    -> 命中前缀否定词: [" + NEG_PREFIX[i] + "]");
      return {negated:true, reason:"前缀含" + NEG_PREFIX[i]};
    }
  }
  var sfx = ft.substring(mt.length + mi, Math.min(ft.length, mi + mt.length + 24));
  console.log("  检查后缀 (24字符): [" + sfx + "]");
  for (var j = 0; j < NEG_SUFFIX.length; j++) {
    if (NEG_SUFFIX[j].test(sfx)) {
      console.log("    -> 命中后缀否定词正则: " + NEG_SUFFIX[j]);
      return {negated:true, reason:"后缀匹配"};
    }
  }
  return {negated:false};
}

function findValidRagMatches(text) {
  var valid = [], neg = [];
  if (!text) return {validMatches:valid, negatedMatches:neg};
  for (var pi = 0; pi < RAG_PATTERNS.length; pi++) {
    var pat = RAG_PATTERNS[pi];
    var rx = new RegExp(pat.source, pat.flags.indexOf("g") >= 0 ? pat.flags : pat.flags + "g");
    var m;
    while ((m = rx.exec(text)) !== null) {
      var base = {patternIndex:pi, matchedText:m[0], matchIndex:m.index};
      base.context = getMatchContext(text, m.index, m[0].length);
      console.log("匹配到: [" + m[0] + "] at index " + m.index + " (pattern " + pi + ")");
      var ck = isNegatedRagMatch(m[0], text, m.index);
      if (ck.negated) { base.negationReason = ck.reason; neg.push(base); console.log("  -> 判为否定"); } 
      else { valid.push(base); console.log("  -> 判为有效"); }
      if (m.index === rx.lastIndex) rx.lastIndex++;
      console.log("");
    }
  }
  return {validMatches:valid, negatedMatches:neg};
}

var sceneStatement = "现场说法：2024-Q2第二批灰度测试，客户咨询退款进度，坐席手动记录的手机号 13900139000 未自动遮蔽。此批次的RAG引用待补充。 RAG引用来源：知识库第5.7节灰度二期现场规范";

console.log("=== 完整文本 ===");
console.log(sceneStatement);
console.log("");
console.log("=== 逐字符位置 (关键片段) ===");
var idx1 = sceneStatement.indexOf("RAG引用待补充");
var idx2 = sceneStatement.indexOf("RAG引用来源");
console.log("'RAG引用待补充' 位置: " + idx1);
console.log("'RAG引用来源' 位置: " + idx2);
console.log("");

console.log("=== RAG 匹配分析 ===");
var result = findValidRagMatches(sceneStatement);
console.log("");
console.log("=== 最终结果 ===");
console.log("有效匹配数: " + result.validMatches.length);
console.log("否定匹配数: " + result.negatedMatches.length);
console.log("");
console.log("有效匹配:");
result.validMatches.forEach(function(v, i) {
  console.log("  " + (i+1) + ". [" + v.matchedText + "] at " + v.matchIndex);
});
console.log("否定匹配:");
result.negatedMatches.forEach(function(v, i) {
  console.log("  " + (i+1) + ". [" + v.matchedText + "] at " + v.matchIndex + " 原因: " + v.negationReason);
});
