with open("src/inspectionEngine.js", "r", encoding="utf-8") as f:
    content = f.read()

old = "const PHONE_REGEX = /1[3-9]\\d{9}/g;"
insert = """
const RAG_PATTERNS = [
  /RAG[ _-]*(引用|证据|来源|出处|reference|cite)/i,
  /(引用|证据|来源|出处)[ _-]*RAG/i,
  /知识库第[^\\s]+节/,
  /引用来源[：:]/,
  /RAG[ _-]*reference/i,
  /\\*RAG\\*/,
  /【RAG[ _-]*(引用|证据|来源|出处)】/,
  /「RAG[ _-]*(引用|证据|来源|出处)」/,
  /RAG[ _-]*引用[ _-]*来源/i,
  /(引用|证据|来源|出处)[ _-]*\\[RAG\\]/i
];

const NEG_PREFIX = ["不是","并非","非","缺少","缺失","未标注","未添加","未填写","无","没有","待补充","尚未","暂未","待补","需补充","未找到","未附上","未提供","缺乏","未包含","未说明"];

const NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];

function isNegatedRagMatch(text, matchText, matchIndex) {
  if (!text) return { negated: false };
  const pfx = text.substring(Math.max(0, matchIndex - 24), matchIndex);
  for (let i = 0; i < NEG_PREFIX.length; i++) {
    if (pfx.indexOf(NEG_PREFIX[i]) >= 0) {
      return { negated: true, reason: "前缀含" + NEG_PREFIX[i] };
    }
  }
  const sfx = text.substring(matchText.length + matchIndex, Math.min(text.length, matchIndex + matchText.length + 24));
  for (let j = 0; j < NEG_SUFFIX.length; j++) {
    if (NEG_SUFFIX[j].test(sfx)) {
      return { negated: true, reason: "后缀匹配" };
    }
  }
  return { negated: false };
}
"""
content = content.replace(old, old + insert)
with open("src/inspectionEngine.js", "w", encoding="utf-8") as f:
    f.write(content)
print("done")
