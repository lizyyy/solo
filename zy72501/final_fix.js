const fs = require('fs');

// ========== 修复 1: test_full_verify.js 中的 global.isNegatedRagMatch ==========
let tfv = fs.readFileSync('test_full_verify.js', 'utf8');

const oldTfvNeg = `global.isNegatedRagMatch = function(mt, ft, mi) {
  var pfx = ft.substring(Math.max(0, mi - 24), mi);
  for (var i = 0; i < global.NEG_PREFIX.length; i++) {
    if (pfx.indexOf(global.NEG_PREFIX[i]) >= 0) return {negated:true, reason:"前缀含" + global.NEG_PREFIX[i]};
  }
  var sfx = ft.substring(mt.length + mi, Math.min(ft.length, mi + mt.length + 24));
  if (!global.NEG_SUFFIX) global.NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];
  for (var j = 0; j < global.NEG_SUFFIX.length; j++) {
    if (global.NEG_SUFFIX[j].test(sfx)) return {negated:true, reason:"后缀"};
  }
  return {negated:false};
};`;

const newTfvNeg = `global.SENTENCE_BOUNDARY = /[。！？!?；;\\n\\r]/;
global.isNegatedRagMatch = function(mt, ft, mi) {
  var fullPfx = ft.substring(Math.max(0, mi - 24), mi);
  var pfx = fullPfx;
  var lastBdry = fullPfx.search(global.SENTENCE_BOUNDARY);
  if (lastBdry >= 0) pfx = fullPfx.substring(lastBdry + 1);
  for (var i = 0; i < global.NEG_PREFIX.length; i++) {
    if (pfx.indexOf(global.NEG_PREFIX[i]) >= 0) return {negated:true, reason:"前缀含" + global.NEG_PREFIX[i]};
  }
  var fullSfx = ft.substring(mt.length + mi, Math.min(ft.length, mi + mt.length + 24));
  var sfx = fullSfx;
  var firstBdry = fullSfx.search(global.SENTENCE_BOUNDARY);
  if (firstBdry >= 0) sfx = fullSfx.substring(0, firstBdry);
  if (!global.NEG_SUFFIX) global.NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];
  for (var j = 0; j < global.NEG_SUFFIX.length; j++) {
    if (global.NEG_SUFFIX[j].test(sfx)) return {negated:true, reason:"后缀"};
  }
  return {negated:false};
};`;

if (tfv.includes(oldTfvNeg)) {
  tfv = tfv.replace(oldTfvNeg, newTfvNeg);
  console.log('[OK] test_full_verify.js: global.isNegatedRagMatch 已修复');
} else {
  console.log('[SKIP] test_full_verify.js: global.isNegatedRagMatch 未找到或已修复');
}

fs.writeFileSync('test_full_verify.js', tfv);

// ========== 修复 2: src/inspectionEngine.js 中的 findValidRagMatches ==========
let ie = fs.readFileSync('src/inspectionEngine.js', 'utf8');

const oldIeConst = `  const NEG_PREFIX = ["不是","并非","非","缺少","缺失","未标注","未添加","未填写","无","没有","待补充","尚未","暂未","待补","需补充","未找到","未附上","未提供","缺乏","未包含","未说明"];
  const NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];`;

const newIeConst = `  const NEG_PREFIX = ["不是","并非","非","缺少","缺失","未标注","未添加","未填写","无","没有","待补充","尚未","暂未","待补","需补充","未找到","未附上","未提供","缺乏","未包含","未说明"];
  const NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];
  const SENTENCE_BOUNDARY = /[。！？!?；;\\n\\r]/;`;

if (ie.includes(oldIeConst) && !ie.includes('SENTENCE_BOUNDARY')) {
  ie = ie.replace(oldIeConst, newIeConst);
  console.log('[OK] inspectionEngine.js: SENTENCE_BOUNDARY 常量已添加');
} else {
  console.log('[SKIP] inspectionEngine.js: SENTENCE_BOUNDARY 常量已存在或未找到');
}

const oldIePfx = `      const pfx = text.substring(Math.max(0, m.index - 24), m.index);
      for (let i = 0; i < NEG_PREFIX.length; i++) {
        if (pfx.indexOf(NEG_PREFIX[i]) >= 0) {
          negated = true;
          negationReason = '前缀含' + NEG_PREFIX[i];
          break;
        }
      }`;

const newIePfx = `      const fullPfx = text.substring(Math.max(0, m.index - 24), m.index);
      let pfx = fullPfx;
      const lastBoundary = fullPfx.search(SENTENCE_BOUNDARY);
      if (lastBoundary >= 0) {
        pfx = fullPfx.substring(lastBoundary + 1);
      }
      for (let i = 0; i < NEG_PREFIX.length; i++) {
        if (pfx.indexOf(NEG_PREFIX[i]) >= 0) {
          negated = true;
          negationReason = '前缀含' + NEG_PREFIX[i];
          break;
        }
      }`;

if (ie.includes(oldIePfx)) {
  ie = ie.replace(oldIePfx, newIePfx);
  console.log('[OK] inspectionEngine.js: 前缀否定检查已修复（句子边界）');
} else {
  console.log('[SKIP] inspectionEngine.js: 前缀否定检查已修复或未找到');
}

const oldIeSfx = `        const sfx = text.substring(m[0].length + m.index, Math.min(text.length, m.index + m[0].length + 24));
        for (let j = 0; j < NEG_SUFFIX.length; j++) {
          if (NEG_SUFFIX[j].test(sfx)) {
            negated = true;
            negationReason = '后缀匹配';
            break;
          }
        }`;

const newIeSfx = `        const fullSfx = text.substring(m[0].length + m.index, Math.min(text.length, m.index + m[0].length + 24));
        let sfx = fullSfx;
        const firstBoundary = fullSfx.search(SENTENCE_BOUNDARY);
        if (firstBoundary >= 0) {
          sfx = fullSfx.substring(0, firstBoundary);
        }
        for (let j = 0; j < NEG_SUFFIX.length; j++) {
          if (NEG_SUFFIX[j].test(sfx)) {
            negated = true;
            negationReason = '后缀匹配';
            break;
          }
        }`;

if (ie.includes(oldIeSfx)) {
  ie = ie.replace(oldIeSfx, newIeSfx);
  console.log('[OK] inspectionEngine.js: 后缀否定检查已修复（句子边界）');
} else {
  console.log('[SKIP] inspectionEngine.js: 后缀否定检查已修复或未找到');
}

// ========== 修复 3: src/inspectionEngine.js 中的 phoneIssuesSummary ==========
const oldPhoneSum = `  // phoneIssuesSummary 计算
  const pendingCount = allPhoneIssues.filter(i => i.status === 'pending_review').length;
  const confirmedCount = allPhoneIssues.filter(i => i.status === 'confirmed').length;
  const phoneItems = allPhoneIssues.map(issue => ({
    phone: issue.phone || issue.phoneNumber,
    phoneNumber: issue.phoneNumber,
    sourceType: issue.sourceType,
    sourceId: issue.sourceId,
    sourceName: issue.sourceName,
    fieldName: issue.fieldName || (issue.rawMaterialSnapshot && issue.rawMaterialSnapshot.fieldName) || 'unknown',
    status: issue.status,
    traceId: issue.traceId,
    context: issue.context || (issue.rawMaterialSnapshot && issue.rawMaterialSnapshot.phoneContext && issue.rawMaterialSnapshot.phoneContext.fullContext) || ''
  }));
  const phoneIssuesSummary = {
    pending: pendingCount,
    confirmed: confirmedCount,
    items: phoneItems
  };`;

const newPhoneSum = `  // phoneIssuesSummary 计算 - 使用 store 中最新的 phoneMaskIssues
  const allPhoneMaskIssues = getPhoneMaskIssues();
  const pendingCount = allPhoneMaskIssues.filter(i => i.status === 'pending_review').length;
  const confirmedCount = allPhoneMaskIssues.filter(i => i.status === 'confirmed').length;
  const phoneItems = allPhoneMaskIssues.map(issue => ({
    phone: issue.phone || issue.phoneNumber,
    phoneNumber: issue.phoneNumber,
    sourceType: issue.sourceType,
    sourceId: issue.sourceId,
    sourceName: issue.sourceName,
    fieldName: issue.fieldName || (issue.rawMaterialSnapshot && issue.rawMaterialSnapshot.fieldName) || 'unknown',
    status: issue.status,
    traceId: issue.traceId,
    context: issue.context || (issue.rawMaterialSnapshot && issue.rawMaterialSnapshot.phoneContext && issue.rawMaterialSnapshot.phoneContext.fullContext) || ''
  }));
  const phoneIssuesSummary = {
    pending: pendingCount,
    confirmed: confirmedCount,
    items: phoneItems
  };`;

if (ie.includes(oldPhoneSum)) {
  ie = ie.replace(oldPhoneSum, newPhoneSum);
  console.log('[OK] inspectionEngine.js: phoneIssuesSummary 已修复（从 store 读取最新状态）');
} else {
  console.log('[SKIP] inspectionEngine.js: phoneIssuesSummary 已修复或未找到');
}

fs.writeFileSync('src/inspectionEngine.js', ie);

console.log('');
console.log('所有修复已完成！');
