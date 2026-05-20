const path = require('path');
const fs = require('fs');
const db = require('../src/models/database');
const importService = require('../src/services/importService');
const ruleEngine = require('../src/services/ruleEngine');
const claimService = require('../src/services/claimService');

async function loadSampleData() {
  console.log('开始加载样例数据...');

  try {
    console.log('1. 创建批次...');
    const batch = await importService.createBatch(
      '2024年5月第一批次理赔材料',
      'v2024.05',
      '理赔内勤-李主管'
    );
    console.log(`   批次创建成功: ${JSON.stringify(batch)}`);

    console.log('2. 解析CSV和JSON文件...');
    const materialCSVPath = path.join(__dirname, '../data/sample_materials.csv');
    const policyJSONPath = path.join(__dirname, '../data/sample_policies.json');
    
    const materialData = await importService.parseMaterialCSV(materialCSVPath);
    const policyData = await importService.parsePolicyJSON(policyJSONPath);
    console.log(`   材料记录: ${materialData.length} 条`);
    console.log(`   保单记录: ${policyData.length} 条`);

    console.log('3. 导入案件记录...');
    const importResult = await importService.importClaimRecords(
      batch.id, 
      materialData, 
      policyData
    );
    console.log(`   导入成功: ${JSON.stringify(importResult)}`);

    console.log('4. 执行规则引擎审核...');
    const processResult = await ruleEngine.processBatch(
      batch.id, 
      '理赔内勤-李主管'
    );
    console.log(`   审核结果: 总计 ${processResult.totalRecords} 条`);
    console.log(`   - 自动通过: ${processResult.autoApproved} 条`);
    console.log(`   - 需要人工复核: ${processResult.needsReview} 条`);

    processResult.details.forEach((detail, index) => {
      if (detail.status === 'needs_manual_review') {
        console.log(`   记录 ${index + 1} (${detail.caseNo}): ${detail.violations.map(v => v.reason).join(', ')}`);
      }
    });

    console.log('5. 人工处理部分记录...');
    
    const records = await claimService.queryRecords({ batchId: batch.id });
    const needsReviewRecords = records.filter(r => r.status === 'needs_manual_review');

    if (needsReviewRecords.length > 0) {
      await claimService.approveRecord(
        needsReviewRecords[0].id,
        '复核专员-王经理',
        '人工审核通过，金额超限已核实符合特殊理赔条款'
      );
      console.log(`   - 批准记录: ${needsReviewRecords[0].case_no}`);
    }

    if (needsReviewRecords.length > 1) {
      await claimService.returnForRevision(
        needsReviewRecords[1].id,
        '复核专员-王经理',
        '材料不完整，退回补充后重新提交'
      );
      console.log(`   - 退回记录: ${needsReviewRecords[1].case_no}`);
    }

    if (needsReviewRecords.length > 2) {
      await claimService.requestMoreMaterials(
        needsReviewRecords[2].id,
        '复核专员-王经理',
        '缺少医疗发票原件，请补充材料'
      );
      console.log(`   - 要求补材料: ${needsReviewRecords[2].case_no}`);
    }

    console.log('\n6. 查询和导出验证...');
    const allRecords = await claimService.queryRecords({ batchId: batch.id });
    console.log(`   总记录数: ${allRecords.length}`);
    
    const csvData = await claimService.exportToCSV(allRecords);
    const exportPath = path.join(__dirname, '../data/export_sample.csv');
    fs.writeFileSync(exportPath, '\uFEFF' + csvData, 'utf8');
    console.log(`   导出文件: ${exportPath}`);

    console.log('\n7. 按案件号查询历史记录...');
    const caseRecords = await claimService.queryRecords({ caseNo: 'CASE-2024-001' });
    console.log(`   案件 CASE-2024-001 找到 ${caseRecords.length} 条记录`);

    if (caseRecords.length > 0) {
      const logs = await claimService.getRecordLogs(caseRecords[0].id);
      console.log(`   处理日志: ${logs.length} 条`);
      logs.forEach(log => {
        console.log(`     - [${log.created_at}] ${log.handler}: ${log.action} - ${log.reason || '无'}`);
      });
    }

    console.log('\n✅ 样例数据加载完成！');
    console.log(`   样例说明:`);
    console.log(`   - CASE-2024-001: 重复报案 (同一案件号出现2次)`);
    console.log(`   - CASE-2024-002: 金额超限 (65000元 > 50000元限额)`);
    console.log(`   - CASE-2024-003: 缺少发票`);
    console.log(`   - CASE-2024-004: 自动通过`);
    console.log(`   - CASE-2024-005: 金额超限 (85000元 > 50000元限额)`);

  } catch (error) {
    console.error('❌ 加载样例数据失败:', error);
  }

  db.close();
}

loadSampleData();
