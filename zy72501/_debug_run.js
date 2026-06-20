const { clearAllData, importDesensitizationRule } = require('./src/models');
const { runInspection, findValidRagMatches, checkPhoneMasking, analyzeCitationGaps, RAG_PATTERNS } = require('./src/inspectionEngine');

console.log("=== Step 1: 清空数据 ===");
clearAllData();

console.log("\n=== Step 2: 导入测试规则A ===");
const ruleA = importDesensitizationRule({
  name: "客户咨询记录脱敏规则",
  remark: "主流程：客户进线记录脱敏归档。注意：/引用 只是路径标记",
  mainProcess: "1.客户进线\n2.记录\n3.脱敏\n4./引用 只是路径标记不是标注RAG引用\n5.存储",
  content: "说明：本规则缺少RAG引用，待算法同事核查后补充来源。测试手机号1：13600136000（故意漏遮）。测试手机号2：在备注里的 13700137000（漏遮）"
}, "算法运营实习生");
console.log("ruleA.id:", ruleA.id);

console.log("\n=== Step 3: 测试 findValidRagMatches ===");
try {
  const result = findValidRagMatches("引用来源：知识库第3.2.1节");
  console.log("findValidRagMatches result:", JSON.stringify(result, null, 2));
} catch (e) {
  console.log("findValidRagMatches ERROR:", e.message, e.stack);
}

console.log("\n=== Step 4: 测试 checkPhoneMasking ===");
try {
  const issues = checkPhoneMasking("测试手机号1：13600136000（故意漏遮）", "rule", ruleA.id, ruleA.name, { fieldName: 'content' });
  console.log("checkPhoneMasking issues count:", issues.length);
  console.log("checkPhoneMasking issues:", JSON.stringify(issues, null, 2));
} catch (e) {
  console.log("checkPhoneMasking ERROR:", e.message, e.stack);
}

console.log("\n=== Step 5: 测试 analyzeCitationGaps ===");
try {
  const gaps = analyzeCitationGaps(ruleA, []);
  console.log("analyzeCitationGaps gaps count:", gaps.length);
  console.log("analyzeCitationGaps gaps:", JSON.stringify(gaps, null, 2));
} catch (e) {
  console.log("analyzeCitationGaps ERROR:", e.message, e.stack);
}

console.log("\n=== Step 6: 运行 runInspection ===");
try {
  const r1 = runInspection("系统管理员");
  console.log("r1 type:", typeof r1);
  console.log("r1 keys:", r1 ? Object.keys(r1) : 'r1 is null/undefined');
  if (r1) {
    console.log("r1.inspection:", r1.inspection ? "存在" : "undefined");
    console.log("r1.exportResult:", r1.exportResult ? "存在" : "undefined");
    console.log("r1.friendlyReport:", r1.friendlyReport ? "存在" : "undefined");
  }
} catch (e) {
  console.log("runInspection ERROR:", e.message);
  console.log("ERROR stack:", e.stack);
}

console.log("\n=== Step 7: 检查 RAG_PATTERNS 数量 ===");
console.log("RAG_PATTERNS.length:", RAG_PATTERNS.length);
console.log("RAG_PATTERNS:", RAG_PATTERNS.map(p => p.toString()));

console.log("\n=== Step 8: 检查 module.exports ===");
const exported = require('./src/inspectionEngine');
console.log("Exported keys:", Object.keys(exported));
console.log("Exported keys count:", Object.keys(exported).length);
