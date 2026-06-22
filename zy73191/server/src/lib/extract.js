function parseFloatStrict(s) {
  if (s == null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function extractFromContent(content) {
  if (!content) return {};
  const s = String(content);
  const contrib = {};

  // 从 "a_1 应为 2" / "a_1=3" / "边界 a_1 应为 2" 中提取
  // 优先匹配 "应为"/"取" 后的数字
  const a1Should = s.match(/a\s*_\s*1\s*(?:应为|应取|取|改为|修正为)\s*(-?\d+(?:\.\d+)?)/);
  const a0Should = s.match(/a\s*_\s*0\s*(?:应为|应取|取|改为|修正为)\s*(-?\d+(?:\.\d+)?)/);
  // 也从 "a_1 = 3" 格式提取边界（只在不与"应为"冲突时使用）
  const a0Eq = s.match(/a\s*_\s*0\s*=\s*(-?\d+(?:\.\d+)?)/);
  const a1Eq = s.match(/a\s*_\s*1\s*=\s*(-?\d+(?:\.\d+)?)/);

  const a0 = a0Should ? parseFloatStrict(a0Should[1]) : a0Eq ? parseFloatStrict(a0Eq[1]) : null;
  // 后补备注中 "a_1 应为 2" 优先于 "a_1=3"
  const a1 = a1Should ? parseFloatStrict(a1Should[1]) : a1Eq ? parseFloatStrict(a1Eq[1]) : null;

  if (a0 != null || a1 != null) {
    contrib.boundary = {};
    if (a0 != null) contrib.boundary.a0 = a0;
    if (a1 != null) contrib.boundary.a1 = a1;
  }

  // 递推式: a_n = 分子 / 分母
  // 匹配 "a_n = ... / (...)" 中 ; 或 ；或 。之前
  const recMatch = s.match(
    /a\s*_\s*n\s*=\s*(.+?)\s*[\/÷]\s*\(?([^;；。\n]+?)\)?\s*(?:[;；。\n]|$)/,
  );
  if (recMatch) {
    let num = recMatch[1].trim();
    let den = recMatch[2].trim();
    num = normVar(num);
    den = normVar(den);
    den = den.replace(/\s*\)\s*$/, "");
    contrib.recurrence = { num, den };
  }

  const quote = pickQuote(s);
  if (quote) contrib.quote = quote;

  return contrib;
}

function normVar(s) {
  let r = s;
  r = r.replace(/a\s*_\s*\{\s*n\s*-\s*1\s*\}/g, "a1");
  r = r.replace(/a\s*_\s*\{\s*n\s*-\s*2\s*\}/g, "a2");
  r = r.replace(/a\s*_\s*n\s*-\s*1\b/g, "a1");
  r = r.replace(/a\s*_\s*n\s*-\s*2\b/g, "a2");
  return r;
}

function pickQuote(s) {
  const patterns = [
    /(边界\s*a\s*_\s*[01]\s*[^；。\n]{0,60})/,
    /(a\s*_\s*1\s*应\s*(?:为|取)[^；。\n]{0,60})/,
    /(a\s*_\s*[01]\s*取\s*过[^；。\n]{0,60})/,
    /(分母[^；。\n]{0,80})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1].trim();
  }
  const first = s.split(/[；。\n]/)[0];
  return first ? first.trim().slice(0, 80) : null;
}

module.exports = { extractFromContent };
