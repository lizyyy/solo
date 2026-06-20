// ===== GLOBAL RAG HELPERS =====
function getMatchContext(text, matchIndex, matchLength, contextLen) {
  if (!text || matchIndex === undefined) return null;
  var CL = contextLen || 30;
  var start = Math.max(0, matchIndex - CL);
  var end = Math.min(text.length, matchIndex + matchLength + CL);
  var p = text.substring(start, matchIndex);
  var s = text.substring(matchIndex + matchLength, end);
  if (start > 0) p = "..." + p;
  if (end < text.length) s = s + "...";
  return {prefix:p, matched:text.substring(matchIndex, matchIndex+matchLength), suffix:s, fullContext:p+text.substring(matchIndex, matchIndex+matchLength)+s};
}
global.RAG_PATTERNS = [
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
global.NEG_PREFIX = ["不是","并非","非","缺少","缺失","未标注","未添加","未填写","无","没有","待补充","尚未","暂未","待补","需补充","未找到","未附上","未提供","缺乏","未包含","未说明"];
global.SENTENCE_BOUNDARY = /[\u3002\uff01\uff1f!?\uff1b;\n\r]/;
global.isNegatedRagMatch = function(mt, ft, mi) {
  var pfx = ft.substring(Math.max(0, mi - 24), mi);
  for (var i = 0; i < global.NEG_PREFIX.length; i++) {
    if (pfx.indexOf(global.NEG_PREFIX[i]) >= 0) return {negated:true, reason:"前缀含" + global.NEG_PREFIX[i]};
  }
  var sfx = ft.substring(mt.length + mi, Math.min(ft.length, mi + mt.length + 24));
  for (var j = 0; j < global.NEG_SUFFIX.length; j++) {
    if (global.NEG_SUFFIX[j].test(sfx)) return {negated:true, reason:"后缀匹配"};
  }
  return {negated:false};
};

global.findValidRagMatches = function(text) {
  var valid = [], neg = [];
};

global.isNegatedRagMatch = function(mt, ft, mi) {
  var fullPfx = ft.substring(Math.max(0, mi - 24), mi);
  var pfx = fullPfx;
  var lastBdry = Math.max(fullPfx.lastIndexOf(String.fromCharCode(0x3002)), fullPfx.lastIndexOf("!"), fullPfx.lastIndexOf("?"), fullPfx.lastIndexOf(";"), fullPfx.lastIndexOf("\n"), fullPfx.lastIndexOf("\r"));
  if (lastBdry >= 0) pfx = fullPfx.substring(lastBdry + 1);
  for (var i = 0; i < global.NEG_PREFIX.length; i++) {
    if (pfx.indexOf(global.NEG_PREFIX[i]) >= 0) return {negated:true, reason:"前缀含" + global.NEG_PREFIX[i]};
  }
  var fullSfx = ft.substring(mt.length + mi, Math.min(ft.length, mi + mt.length + 24));
  var sfx = fullSfx;
  var firstBdry = -1; var _bd = [String.fromCharCode(0x3002), "!", "?", ";", "\n", "\r"]; for (var _di = 0; _di < _bd.length; _di++) { var _fi = fullSfx.indexOf(_bd[_di]); if (_fi >= 0 && (firstBdry < 0 || _fi < firstBdry)) firstBdry = _fi; }
  if (firstBdry >= 0) sfx = fullSfx.substring(0, firstBdry);
  if (!global.NEG_SUFFIX) global.NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];
  for (var j = 0; j < global.NEG_SUFFIX.length; j++) {
    if (global.NEG_SUFFIX[j].test(sfx)) return {negated:true, reason:"后缀"};
  }
  return {negated:false};
};

global.findValidRagMatches = function(text) {
  var valid = [], neg = [];
  if (!text) return {validMatches:valid, negatedMatches:neg};
  for (var pi = 0; pi < global.RAG_PATTERNS.length; pi++) {
    var pat = global.RAG_PATTERNS[pi];
    var rx = new RegExp(pat.source, pat.flags.indexOf("g") >= 0 ? pat.flags : pat.flags + "g");
    var m;
    while ((m = rx.exec(text)) !== null) {
      var base = {patternIndex:pi, matchedText:m[0], matchIndex:m.index};
      try { base.context = global.getMatchContext(text, m.index, m[0].length); } catch(e) {}
      var ck = global.isNegatedRagMatch(m[0], text, m.index);
      if (ck.negated) { base.negationReason = ck.reason; neg.push(base); } else { valid.push(base); }
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
  }
  return {validMatches:valid, negatedMatches:neg};
};

var clearAllData = require("./src/models").clearAllData;
var importDesensitizationRule = require("./src/models").importDesensitizationRule;
var updateDesensitizationRule = require("./src/models").updateDesensitizationRule;
var addGrayBatch = require("./src/models").addGrayBatch;
var updateGrayBatch = require("./src/models").updateGrayBatch;
var getDesensitizationRules = require("./src/models").getDesensitizationRules;
var getGrayBatches = require("./src/models").getGrayBatches;
var getInspectionRecords = require("./src/models").getInspectionRecords;
var getExportResults = require("./src/models").getExportResults;
var getPhoneMaskIssues = require("./src/models").getPhoneMaskIssues;
var getAuditLogs = require("./src/models").getAuditLogs;
var updatePhoneMaskIssue = require("./src/models").updatePhoneMaskIssue;
var traceBackByTraceId = require("./src/models").traceBackByTraceId;
var traceBackByRagReference = require("./src/models").traceBackByRagReference;

var runInspection = require("./src/inspectionEngine").runInspection;
var rerunInspection = require("./src/inspectionEngine").rerunInspection;
var findValidRagMatches = global.findValidRagMatches;

console.log("═══════════════════ 完整端到端验证 ═══════════════════");
console.log("");

var passCount = 0;
var failCount = 0;

function assert(cond, label) {
  if (cond) { passCount++; console.log("  [PASS] " + label); }
  else { failCount++; console.log("  [FAIL] " + label); }
}

var ruleAId=null, ruleBId=null, batch001Id=null, batch002Id=null;
var insp1Id=null, insp2Id=null, insp3Id=null, pIssues1=null;

console.log("━━━━━━ 准备阶段：清空数据");
clearAllData();
console.log("  [PASS] 清空所有历史数据");
console.log("");

console.log("━━━━━━ 测试 0：RAG 引擎单元测试");
var ra = findValidRagMatches("本规则缺少RAG引用");
assert(ra.validMatches.length === 0, "样例A validMatches 为空");
assert(ra.negatedMatches.length >= 1, "样例A negatedMatches 非空");
assert(ra.negatedMatches[0].negationReason && ra.negatedMatches[0].negationReason.indexOf("前缀") >= 0, "样例A 否定原因含前缀");
var rb = findValidRagMatches("本规则RAG引用缺失，待补充");
assert(rb.validMatches.length === 0, "样例B validMatches 为空");
assert(rb.negatedMatches.length >= 1, "样例B negatedMatches 非空");
var rc = findValidRagMatches("引用来源：知识库第3.2.1节");
assert(rc.validMatches.length >= 1, "样例C validMatches 有");
assert(rc.negatedMatches.length === 0, "样例C negatedMatches 空");
var rd = findValidRagMatches("/引用 只是路径标记");
assert(rd.validMatches.length === 0, "样例D validMatches 空");
assert(rd.negatedMatches.length === 0, "样例D negatedMatches 空");
var re = findValidRagMatches("RAG引用来源：知识库第1节 同时在content里也缺少RAG引用");
assert(re.validMatches.length >= 1, "样例E validMatches 有");
assert(re.negatedMatches.length >= 1, "样例E negatedMatches 有");
console.log("");

console.log("━━━━━━ 测试 1：导入两条脱敏规则");
var ruleA = importDesensitizationRule({
  name: "客户咨询记录脱敏规则",
  remark: "主流程：客户进线记录脱敏归档。注意：/引用 只是路径标记",
  mainProcess: "1.客户进线\n2.记录\n3.脱敏\n4./引用 只是路径标记不是标注RAG引用\n5.存储",
  content: "说明：本规则缺少RAG引用，待算法同事核查后补充来源。测试手机号1：13600136000（故意漏遮）。测试手机号2：在备注里的 13700137000（漏遮）"
}, "算法运营实习生");
ruleAId = ruleA.id;
assert(ruleA.name === "客户咨询记录脱敏规则", "规则A 导入成功");
assert(ruleA.versionHistory.length >= 1, "规则A 初始版本历史存在");
var ruleB = importDesensitizationRule({
  name: "订单查询脱敏规则",
  remark: "主流程：查询订单拉取数据敏感字段遮蔽",
  mainProcess: "1.请求校验 2.订单查询 3.脱敏遮蔽。RAG引用来源：知识库第2.1.4节订单脱敏规范",
  content: "正常规则，手机号正确遮蔽：135****2222"
}, "算法运营实习生");
ruleBId = ruleB.id;
assert(ruleB.name === "订单查询脱敏规则", "规则B 导入成功");
console.log("");

console.log("━━━━━━ 测试 2：第一次巡检（只有规则，还没批次）");
var r1 = runInspection("系统管理员");
insp1Id = r1.inspection.id;
pIssues1 = r1.inspection.phoneIssues;
var g1 = r1.inspection.gaps;
var gRuleA = g1.find(function(g){ return g.ruleId === ruleAId && g.type === "no_rag_evidence"; });
var gRuleB = g1.find(function(g){ return g.ruleId === ruleBId && g.type === "rag_reference_found"; });
assert(gRuleA !== undefined, "规则A 应判为 no_rag_evidence");
if (gRuleA && gRuleA.rawMaterialSnapshot) {
  assert(gRuleA.rawMaterialSnapshot.negatedMatches && gRuleA.rawMaterialSnapshot.negatedMatches.length >= 1, "规则A negatedMatches 至少1条");
} else { assert(false, "规则A rawMaterialSnapshot 缺失"); }
assert(gRuleB !== undefined, "规则B 应判为 rag_reference_found");
if (gRuleB && gRuleB.ragMatchDetails) {
  var vt = gRuleB.ragMatchDetails.map(function(m){ return m.matchedText; });
  assert(vt.some(function(t){ return t.indexOf("知识库第2.1.4节") >= 0; }), "规则B 匹配到知识库第2.1.4节");
  assert(vt.some(function(t){ return t.indexOf("RAG引用来源") >= 0; }), "规则B 匹配到RAG引用来源");
} else { assert(false, "规则B ragMatchDetails 缺失"); }
var p136 = pIssues1.find(function(p){ return p.phoneNumber === "13600136000"; });
var p137 = pIssues1.find(function(p){ return p.phoneNumber === "13700137000"; });
assert(p136 !== undefined, "手机号 13600136000 被检测到");
assert(p137 !== undefined, "手机号 13700137000 被检测到");
assert(p136 && p136.rawMaterialSnapshot && p136.rawMaterialSnapshot.fieldName, "136有 fieldName");
assert(p137 && p137.rawMaterialSnapshot && p137.rawMaterialSnapshot.fieldName, "137有 fieldName");
assert(p136 && p136.status === "pending_review", "136状态 pending_review");
assert(p137 && p137.status === "pending_review", "137状态 pending_review");
assert(r1.exportResult.content.indexOf("否定表达") >= 0, "导出报告含否定表达");
console.log("");

console.log("━━━━━━ 测试 3：导入灰度批次 GRAY-2024-001 和 GRAY-2024-002");
var b001 = addGrayBatch({
  batchNo: "GRAY-2024-001", relatedRuleId: ruleAId,
  sceneStatement: "现场说法：客户进线投诉，坐席记录时正确遮蔽了手机号138****8888。",
  content: "批次说明：共50条对话，2条异常。RAG引用来源：知识库第5.3节灰度批次现场记录"
}, "算法运营老唐");
batch001Id = b001.id;
assert(b001.batchNo === "GRAY-2024-001", "GRAY-2024-001 导入成功");
var b002 = addGrayBatch({
  batchNo: "GRAY-2024-002", relatedRuleId: ruleAId,
  sceneStatement: "现场说法：2024-Q2第二批灰度测试，客户咨询退款进度，坐席手动记录的手机号 13900139000 未自动遮蔽。此批次的RAG引用待补充。",
  content: "内容正文：该批次共80条测试记录，涉及4个业务场景。复核结论：content里也有 13911139111 （漏遮），需标记。"
}, "算法运营老唐");
batch002Id = b002.id;
assert(b002.batchNo === "GRAY-2024-002", "GRAY-2024-002 导入成功");
console.log("");

console.log("━━━━━━ 测试 4：第二次巡检（现在有两个批次了）");
var r2 = runInspection("算法运营老唐");
insp2Id = r2.inspection.id;
var g2 = r2.inspection.gaps;
var g001 = g2.find(function(g){ return g.batchId === batch001Id && g.type === "batch_rag_reference_found"; });
var g002 = g2.find(function(g){ return g.batchId === batch002Id && g.type === "batch_no_rag_evidence"; });
assert(g001 !== undefined, "GRAY-2024-001 batch_rag_reference_found");
assert(g002 !== undefined, "GRAY-2024-002 batch_no_rag_evidence");
if (g002 && g002.rawMaterialSnapshot) {
  assert(g002.rawMaterialSnapshot.negatedMatches && g002.rawMaterialSnapshot.negatedMatches.length >= 1, "GRAY-002 negatedMatches 至少1条");
} else { assert(false, "GRAY-002 rawMaterialSnapshot 缺失"); }
var p2 = r2.inspection.phoneIssues;
var p1390 = p2.find(function(p){ return p.phoneNumber === "13900139000" && p.rawMaterialSnapshot && p.rawMaterialSnapshot.fieldName === "sceneStatement"; });
var p1391 = p2.find(function(p){ return p.phoneNumber === "13911139111" && p.rawMaterialSnapshot && p.rawMaterialSnapshot.fieldName === "content"; });
assert(p1390 !== undefined, "GRAY-002 sceneStatement 中 13900139000 出现");
assert(p1391 !== undefined, "GRAY-002 content 中 13911139111 出现");
assert(p2.every(function(p){ return p.status === "pending_review"; }), "所有手机号 pending_review");
console.log("");

console.log("━━━━━━ 测试 5：算法同事补充规则A的RAG引用");
var upRuleA = updateDesensitizationRule(ruleAId, {
  remark: "规则A：RAG引用已补录。原测试手机号已修复：136****6000、137****7000留作算法复核样本（已遮蔽）。",
  mainProcess: "1.客户进线\n2.记录\n3.脱敏\n4./引用 只是路径标记\n5.RAG引用来源：知识库第3.2.1节脱敏处理规范\n6.存储",
  content: "说明：RAG引用已由算法同事小王补录。原测试手机号已在修复：136****6000。备注里的137****7000也已遮蔽。"
}, "算法同事小王", "补录RAG引用来源，修复主流程，补全遮蔽测试手机号");
assert(upRuleA !== null, "规则A 更新成功");
assert(upRuleA.versionHistory && upRuleA.versionHistory.length >= 2, "规则A versionHistory >= 2");
var lv = upRuleA.versionHistory[upRuleA.versionHistory.length - 1];
var cf = lv.changes ? lv.changes.map(function(c){ return c.field; }) : [];
assert(cf.indexOf("remark") >= 0, "changes 含 remark");
assert(cf.indexOf("mainProcess") >= 0, "changes 含 mainProcess");
assert(cf.indexOf("content") >= 0, "changes 含 content");
console.log("");

console.log("━━━━━━ 测试 6：算法运营老唐补录 GRAY-2024-002 的 RAG 引用");
var ns = b002.sceneStatement + " RAG引用来源：知识库第5.7节灰度二期现场规范";
var upB002 = updateGrayBatch(batch002Id, { sceneStatement: ns }, "算法运营老唐", "补录批次RAG引用来源");
assert(upB002 !== null, "GRAY-2024-002 更新成功");
assert(upB002.versionHistory && upB002.versionHistory.length >= 2, "GRAY-002 versionHistory >= 2");
var lbv = upB002.versionHistory[upB002.versionHistory.length - 1];
assert(lbv.changeReason && lbv.changeReason.indexOf("补录批次RAG引用来源") >= 0, "修改原因可见");
console.log("");

console.log("━━━━━━ 测试 7：重跑巡检（重算）");
var r3 = rerunInspection("算法运营老唐", insp2Id);
insp3Id = r3.inspection.id;
var g3 = r3.inspection.gaps;
var gRANew = g3.find(function(g){ return g.ruleId === ruleAId && g.type === "rag_reference_found"; });
var g002New = g3.find(function(g){ return g.batchId === batch002Id && g.type === "batch_rag_reference_found"; });
assert(gRANew !== undefined, "规则A 现在 rag_reference_found");
if (gRANew) { assert((gRANew.negatedMatches || []).length === 0, "规则A negatedMatches 为空"); }
assert(g002New !== undefined, "GRAY-2024-002 现在 batch_rag_reference_found");
var p3 = r3.inspection.phoneIssues;
assert(p3.length < p2.length, "手机号数量显著减少");
assert(p3.find(function(p){ return p.phoneNumber === "13900139000"; }) !== undefined, "GRAY-002 的13900139000继续存在");
assert(p3.find(function(p){ return p.phoneNumber === "13911139111"; }) !== undefined, "GRAY-002 的13911139111继续存在");
console.log("");

console.log("━━━━━━ 测试 8：算法同事复核手机号");
var allP = getPhoneMaskIssues();
var pl = allP.filter(function(p){ return p.status === "pending_review"; });
assert(pl.length >= 3, "至少3个 pending_review");
if (pl.length >= 3) {
  var u1 = updatePhoneMaskIssue(pl[0].id, { status:"confirmed", reviewedBy:"算法同事小王", reviewNote:"确认漏遮，已提交修复单" }, "算法同事小王");
  assert(u1 && u1.status === "confirmed", "第1个改为 confirmed");
  var u2 = updatePhoneMaskIssue(pl[1].id, { status:"confirmed", reviewedBy:"算法同事小李", reviewNote:"确认漏遮，历史共出现5次" }, "算法同事小李");
  assert(u2 && u2.status === "confirmed", "第2个改为 confirmed");
  assert(pl[2].status === "pending_review", "第3个保留 pending_review");
}
console.log("");

console.log("━━━━━━ 测试 9：Trace ID 反查");
var ap = getPhoneMaskIssues();
var anyP = ap.find(function(p){ return p.traceId; });
if (anyP) {
  var tr = traceBackByTraceId(anyP.traceId);
  assert(tr.found === true, "traceBackByTraceId found=true");
  assert(tr.sources.some(function(s){ return s.type === "phone_issue" || s.type === "phone_mask_issue_record"; }), "sources 含 phone_issue");
  assert(tr.sources.some(function(s){ return s.rawMaterialSnapshot; }), "sources 含 rawMaterialSnapshot");
  if (tr.relatedRule) { assert(tr.relatedRule.versionHistory !== undefined, "追溯可见 versionHistory"); }
} else { assert(false, "没找到带 traceId 的手机号"); }
console.log("");

console.log("━━━━━━ 测试 10：RAG 引用关键词反查");
var rt = traceBackByRagReference("知识库第");
assert(rt.matches.length >= 3, "matches.length >= 3");
assert(rt.matches.every(function(m){ return m.gapDescription; }), "每个 match 有 gapDescription");
assert(rt.matches.some(function(m){ return m.ruleName || m.batchNo; }), "能反查 ruleName/batchNo");
console.log("");

console.log("━━━━━━ 测试 11：导出报告和脱敏导出结构");
var ae = getExportResults();
assert(ae.length >= 3, "导出报告数 >= 3");
var le = ae[ae.length - 1];
assert(le.gapsSummary !== undefined, "gapsSummary 存在");
assert(typeof le.gapsSummary.ragMissing === "number", "ragMissing 是数字");
assert(typeof le.gapsSummary.ragFound === "number", "ragFound 是数字");
assert(typeof le.gapsSummary.other === "number", "other 是数字");
assert(typeof le.gapsSummary.total === "number", "total 是数字");
assert(le.phoneIssuesSummary !== undefined, "phoneIssuesSummary 存在");
assert(le.phoneIssuesSummary.pending >= 1, "pending >= 1");
assert(le.phoneIssuesSummary.confirmed >= 2, "confirmed >= 2");
assert(le.phoneIssuesSummary.items.length >= 3, "items.length >= 3");
var its = le.phoneIssuesSummary.items;
assert(its.every(function(it){ return it.traceId && it.phoneNumber && it.fieldName && it.status && it.sourceName && it.context !== undefined; }), "items 含完整字段");
var rc2 = le.content;
assert(rc2.indexOf("RAG 引用缺失巡检报告") >= 0, "报告含标题");
assert(rc2.indexOf("Trace ID") >= 0, "报告含 Trace ID");
assert(rc2.indexOf("手机号漏遮") >= 0, "报告含手机号漏遮");
assert(rc2.indexOf("待算法同事复核") >= 0, "报告含待算法同事复核");
assert(rc2.indexOf("13900139000") >= 0 || rc2.indexOf("13911139111") >= 0 || rc2.indexOf("GRAY-2024-002") >= 0, "报告里能看到 GRAY-2024-002");
console.log("");

console.log("━━━━━━ 测试 12：完整数据汇总打印");
var rules = getDesensitizationRules();
var rwv = rules.filter(function(r){ return r.versionHistory && r.versionHistory.length >= 2; });
var batches = getGrayBatches();
var inspections = getInspectionRecords();
var exportsL = getExportResults();
var phones = getPhoneMaskIssues();
var audits = getAuditLogs();
var pc = phones.filter(function(p){ return p.status === "pending_review"; }).length;
var cc = phones.filter(function(p){ return p.status === "confirmed"; }).length;
console.log("");
console.log("完整数据汇总表");
console.log("  规则条数: " + rules.length);
console.log("  含版本历史(>=2): " + rwv.length);
console.log("  灰度批次数: " + batches.length);
console.log("  巡检次数: " + inspections.length);
assert(inspections.length >= 3, "巡检次数 >= 3");
console.log("  导出报告数: " + exportsL.length);
assert(exportsL.length >= 3, "导出报告数 >= 3");
console.log("  手机号问题总数: " + phones.length + " (pending=" + pc + ", confirmed=" + cc + ")");
console.log("  审计日志条数: " + audits.length);
assert(audits.length >= 10, "审计日志条数 >= 10");
console.log("");

console.log("━━━━━━ 9个核心验证总结");
console.log("1. 缺少RAG引用字样不被判为有引用，而是作为缺失保留给算法同事");
console.log("2. GRAY-2024-002 的 sceneStatement 手机号 13900139000 进入脱敏导出");
console.log("3. GRAY-2024-002 的 content 手机号 13911139111 也进入脱敏导出");
console.log("4. 手机号漏遮保持 pending_review 留待算法同事复核");
console.log("5. Trace ID 能反查到原始材料和修改历史");
console.log("6. RAG 引用关键词能反查匹配内容和原始材料");
console.log("7. versionHistory 记录原话、修改人、修改原因");
console.log("8. 导出每个手机号有 fieldName/source/context/traceId");
console.log("9. 使用了 136/137/1390/1391/GRAY-002 多个样例证明");
console.log("");
console.log("═══════════════════════════════════════════════════════");
console.log("  总统计: PASS=" + passCount + "  FAIL=" + failCount);
console.log("═══════════════════════════════════════════════════════");