with open("src/inspectionEngine.js", "r", encoding="utf-8") as f:
    content = f.read()

# 找到 function findValidRagMatches 的定义，替换内部实现
old_func = """function findValidRagMatches(text) {
  const NEG_PREFIX = ["不是","并非","非","缺少","缺失","未标注","未添加","未填写","无","没有","待补充","尚未","暂未","待补","需补充","未找到","未附上","未提供","缺乏","未包含","未说明"];
  const NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];
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

  const valid = [];
  const neg = [];
  if (!text) return { validMatches: valid, negatedMatches: neg };
  
  for (let pi = 0; pi < RAG_PATTERNS.length; pi++) {
    const pat = RAG_PATTERNS[pi];
    const rx = new RegExp(pat.source, pat.flags.indexOf("g") >= 0 ? pat.flags : pat.flags + "g");
    let m;
    while ((m = rx.exec(text)) !== null) {
      const base = {
        patternIndex: pi,
        matchedText: m[0],
        matchIndex: m.index,
        context: getMatchContext(text, m.index, m[0].length)
      };
      
      let negated = false;
      let negationReason = "";
      
      const pfx = text.substring(Math.max(0, m.index - 24), m.index);
      for (let i = 0; i < NEG_PREFIX.length; i++) {
        if (pfx.indexOf(NEG_PREFIX[i]) >= 0) {
          negated = true;
          negationReason = "前缀含" + NEG_PREFIX[i];
          break;
        }
      }
      
      if (!negated) {
        const sfx = text.substring(m[0].length + m.index, Math.min(text.length, m.index + m[0].length + 24));
        for (let j = 0; j < NEG_SUFFIX.length; j++) {
          if (NEG_SUFFIX[j].test(sfx)) {
            negated = true;
            negationReason = "后缀匹配";
            break;
          }
        }
      }
      
      if (negated) {
        base.negationReason = negationReason;
        neg.push(base);
      } else {
        valid.push(base);
      }
      
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
  }
  
  return { validMatches: valid, negatedMatches: neg };
}"""

new_func = """function findValidRagMatches(text) {
  const valid = [];
  const neg = [];
  if (!text) return { validMatches: valid, negatedMatches: neg };
  
  for (let pi = 0; pi < RAG_PATTERNS.length; pi++) {
    const pat = RAG_PATTERNS[pi];
    const rx = new RegExp(pat.source, pat.flags.indexOf("g") >= 0 ? pat.flags : pat.flags + "g");
    let m;
    while ((m = rx.exec(text)) !== null) {
      const base = {
        patternIndex: pi,
        matchedText: m[0],
        matchIndex: m.index,
        context: getMatchContext(text, m.index, m[0].length)
      };
      
      const nr = isNegatedRagMatch(text, m[0], m.index);
      if (nr.negated) {
        base.negationReason = nr.reason;
        neg.push(base);
      } else {
        valid.push(base);
      }
      
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
  }
  
  return { validMatches: valid, negatedMatches: neg };
}"""

if old_func in content:
    content = content.replace(old_func, new_func)
    print("replaced findValidRagMatches")
else:
    print("old_func not found!")

with open("src/inspectionEngine.js", "w", encoding="utf-8") as f:
    f.write(content)
print("done")
