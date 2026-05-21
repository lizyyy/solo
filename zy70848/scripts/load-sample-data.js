const path = require("path");
const fs = require("fs");
const db = require("../src/models/database");
const importService = require("../src/services/importService");
const ruleEngine = require("../src/services/ruleEngine");
const ruleService = require("../src/services/ruleService");
const claimService = require("../src/services/claimService");

async function loadSampleData() {
  console.log("开始加载样例数据...");
  try {
    console.log("0. 导入规则表...");
    await ruleService.clearAllRules();
    const rulesResult = await ruleService.importRulesFromJSON(path.join(__dirname, "../data/sample_rules.json"));
    console.log("   规则导入: 总计 " + rulesResult.total + ", 成功 " + rulesResult.imported + " 条");
    
    console.log("1. 创建批次...");
    const batch = await importService.createBatch("2024年5月批次", "v2024.05", "理赔内勤-李主管");
    console.log("   批次创建成功: " + JSON.stringify(batch));
    
    console.log("2. 解析CSV和JSON...");
    const materialData = await importService.parseMaterialCSV(path.join(__dirname, "../data/sample_materials.csv"));
    const policyData = await importService.parsePolicyJSON(path.join(__dirname, "../data/sample_policies.json"));
    console.log("   材料: " + materialData.length + " 条, 保单: " + policyData.length + " 条");
    
    console.log("3. 导入案件记录...");
    await importService.importClaimRecords(batch.id, materialData, policyData);
    
    console.log("4. 执行规则引擎审核...");
    const result = await ruleEngine.processBatch(batch.id, "理赔内勤-李主管");
    console.log("   总计: " + result.totalRecords + ", 自动通过: " + result.autoApproved + ", 需复核: " + result.needsReview);
    
    console.log("\n✅ 样例数据加载完成！");
    console.log("   样例说明:");
    console.log("   - CASE-2024-001: 重复报案 (同一案件号出现2次)");
    console.log("   - CASE-2024-002: 金额超限 (65000元 > 50000元限额)");
    console.log("   - CASE-2024-003: 缺少发票");
    console.log("   - CASE-2024-004: 自动通过");
    console.log("   - CASE-2024-005: 金额超限 (85000元 > 50000元限额)");
  } catch(e) { 
    console.error("失败:", e); 
  }
  db.close();
}

loadSampleData();
