with open("src/inspectionEngine.js", "r", encoding="utf-8") as f:
    content = f.read()

old = """      const nr = isNegatedRagMatch(text, m[0], m.index);
      if (nr.negated) {
        base.negationReason = nr.reason;
        neg.push(base);
      } else {
        valid.push(base);
      }"""

new = """      const nr = isNegatedRagMatch(text, m[0], m.index);
      if (pi === 2) {
        valid.push(base);
      } else if (nr.negated) {
        base.negationReason = nr.reason;
        neg.push(base);
      } else {
        valid.push(base);
      }"""

if old in content:
    content = content.replace(old, new)
    print("replaced negation logic")
else:
    print("old pattern not found, checking internal version...")
    old2 = """      if (negated) {
        base.negationReason = negationReason;
        neg.push(base);
      } else {
        valid.push(base);
      }"""
    if old2 in content:
        new2 = """      if (pi === 2) {
        valid.push(base);
      } else if (negated) {
        base.negationReason = negationReason;
        neg.push(base);
      } else {
        valid.push(base);
      }"""
        content = content.replace(old2, new2)
        print("replaced internal negation logic")
    else:
        print("neither pattern found")

with open("src/inspectionEngine.js", "w", encoding="utf-8") as f:
    f.write(content)
print("done")
