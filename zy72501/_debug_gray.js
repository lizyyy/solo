var clearAllData = require("./src/models").clearAllData;
var addGrayBatch = require("./src/models").addGrayBatch;
var updateGrayBatch = require("./src/models").updateGrayBatch;
var getGrayBatches = require("./src/models").getGrayBatches;
var runInspection = require("./src/inspectionEngine").runInspection;
var rerunInspection = require("./src/inspectionEngine").rerunInspection;
var findValidRagMatches = require("./src/inspectionEngine").findValidRagMatches;
var getExportResults = require("./src/models").getExportResults;

clearAllData();

var b002 = addGrayBatch({
  batchNo: "GRAY-2024-002",
  relatedRuleId: "test-rule-id",
  sceneStatement: "现场说法：2024-Q2第二批灰度测试，客户咨询退款进度，坐席手动记录的手机号 13900139000 未自动遮蔽。此批次的RAG引用待补充。",
  content: "内容正文：该批次共80条测试记录，涉及4个业务场景。复核结论：content里也有 13911139111 （漏遮），需标记。"
}, "算法运营老唐");

console.log("=== 更新前的 sceneStatement ===");
console.log(b002.sceneStatement);

var ragBefore = findValidRagMatches(b002.sceneStatement + "\n" + b002.content);
console.log("\n=== 更新前的 RAG 匹配 ===");
console.log("validMatches:", ragBefore.validMatches.map(m => m.matchedText));
console.log("negatedMatches:", ragBefore.negatedMatches.map(m => ({text: m.matchedText, reason: m.negationReason})));

var ns = b002.sceneStatement + " RAG引用来源：知识库第5.7节灰度二期现场规范";
var upB002 = updateGrayBatch(b002.id, { sceneStatement: ns }, "算法运营老唐", "补录批次RAG引用来源");

console.log("\n=== 更新后的 sceneStatement ===");
console.log(upB002.sceneStatement);

var ragAfter = findValidRagMatches(upB002.sceneStatement + "\n" + upB002.content);
console.log("\n=== 更新后的 RAG 匹配 ===");
console.log("validMatches:", ragAfter.validMatches.map(m => m.matchedText));
console.log("negatedMatches:", ragAfter.negatedMatches.map(m => ({text: m.matchedText, reason: m.negationReason})));

console.log("\n=== 确认 store 中的数据 ===");
var batches = getGrayBatches();
var stored = batches.find(b => b.id === b002.id);
console.log("store 中 sceneStatement:", stored.sceneStatement);

console.log("\n=== 运行巡检看看结果 ===");
var r1 = runInspection("测试员");
var gaps1 = r1.inspection.gaps;
var g002_1 = gaps1.find(g => g.batchId === b002.id);
console.log("第一次巡检 - GRAY-002 type:", g002_1 ? g002_1.type : "没找到");
console.log("第一次导出 gapsSummary:", r1.exportResult.gapsSummary);

console.log("\n=== 重跑巡检 ===");
var r2 = rerunInspection("测试员", r1.inspection.id);
var gaps2 = r2.inspection.gaps;
var g002_2 = gaps2.find(g => g.batchId === b002.id);
console.log("重跑巡检 - GRAY-002 type:", g002_2 ? g002_2.type : "没找到");

console.log("\n=== 所有导出结果 ===");
var exports = getExportResults();
console.log("导出数量:", exports.length);
exports.forEach((e, i) => {
  console.log(`  导出${i}: gapsSummary=${e.gapsSummary !== undefined}, phoneIssuesSummary=${e.phoneIssuesSummary !== undefined}`);
  if (e.gapsSummary) console.log("    gapsSummary:", JSON.stringify(e.gapsSummary));
});
