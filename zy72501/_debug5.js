const { runInspection, rerunInspection, getPhoneMaskIssues, updateDesensitizationRule, updateGrayBatch, getDesensitizationRules, getGrayBatches, getExportResults } = require("./src/inspectionEngine");

// 先删除旧数据
const fs = require("fs");
const path = require("path");
const storePath = path.join(__dirname, "data", "store.json");
if (fs.existsSync(storePath)) { fs.unlinkSync(storePath); }

// 模拟测试1-7的步骤
var rules = getDesensitizationRules();
var batches = getGrayBatches();
var ruleAId = rules.find(r => r.remark && r.remark.indexOf("规则A") >= 0).id;
var batch002Id = batches.find(b => b.batchNo === "GRAY-2024-002").id;
var b002 = batches.find(b => b.batchNo === "GRAY-2024-002");

console.log("规则A原始content:", rules.find(r => r.id === ruleAId).content);
console.log("");

// 测试3：第一次巡检
var r1 = runInspection("算法运营老唐");
var pIssues1 = r1.inspection.phoneIssues;
console.log("测试3手机号数量:", pIssues1.length);
pIssues1.forEach((p,i) => console.log("  p"+i, p.phoneNumber, p.status, p.rawMaterialSnapshot ? p.rawMaterialSnapshot.fieldName : "no field"));
console.log("");

// 测试5：更新规则A
var upRuleA = updateDesensitizationRule(ruleAId, {
  mainProcess: "1.客户进线\n2.记录\n3.脱敏\n4./引用 只是路径标记\n5.RAG引用来源：知识库第3.2.1节脱敏处理规范\n6.存储",
  content: "说明：RAG引用已由算法同事小王补录。原测试手机号已在修复：136****6000。备注里的137****7000也已遮蔽。"
}, "算法同事小王", "补录RAG引用来源");
console.log("更新后规则A content:", upRuleA.content);
console.log("");

// 测试6：更新批次002
var ns = b002.sceneStatement + " RAG引用来源：知识库第5.7节灰度二期现场规范";
var upB002 = updateGrayBatch(batch002Id, { sceneStatement: ns }, "算法运营老唐", "补录批次RAG引用来源");
console.log("更新后批次002 sceneStatement:", upB002.sceneStatement);
console.log("");

// 测试7：重跑
var r3 = rerunInspection("算法运营老唐", r1.inspection.id);
var p3 = r3.inspection.phoneIssues;
console.log("测试7手机号数量:", p3.length);
p3.forEach((p,i) => console.log("  p"+i, p.phoneNumber, p.status, p.rawMaterialSnapshot ? p.rawMaterialSnapshot.fieldName : "no field"));
console.log("");
console.log("pIssues1.length:", pIssues1.length, "p3.length:", p3.length);
console.log("p3 < pIssues1?", p3.length < pIssues1.length);

// 测试8：复核
var allP = getPhoneMaskIssues();
var pl = allP.filter(p => p.status === "pending_review");
console.log("pending数量:", pl.length);
if (pl.length >= 3) {
  updateDesensitizationRule ? null : null;
  const { updatePhoneMaskIssue } = require("./src/inspectionEngine");
  var u1 = updatePhoneMaskIssue(pl[0].id, { status:"confirmed", reviewedBy:"算法同事小王", reviewNote:"确认漏遮" }, "算法同事小王");
  var u2 = updatePhoneMaskIssue(pl[1].id, { status:"confirmed", reviewedBy:"算法同事小李", reviewNote:"确认漏遮" }, "算法同事小李");
  console.log("u1.status:", u1.status, "u2.status:", u2.status);
}

// 检查最后一个exportResult
var ae = getExportResults();
var le = ae[ae.length - 1];
console.log("");
console.log("最后一个exportResult phoneIssuesSummary:");
console.log("  pending:", le.phoneIssuesSummary.pending);
console.log("  confirmed:", le.phoneIssuesSummary.confirmed);
console.log("  items.length:", le.phoneIssuesSummary.items.length);
if (le.phoneIssuesSummary.items.length > 0) {
  console.log("  items[0] keys:", Object.keys(le.phoneIssuesSummary.items[0]).join(","));
}
