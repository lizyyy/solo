const { UnifiedDataAccess } = require('./src');

async function runExample() {
  console.log('=== 声学隔断降噪评估系统 示例 ===\n');

  const dataAccess = new UnifiedDataAccess();
  const evaluationId = dataAccess.startNewEvaluation('老唐');
  console.log(`创建评估任务: ${evaluationId}\n`);

  const temperatureRecords = [
    { sensorId: 'S001', calibrationTime: '2024-01-15 09:00:00', temperature: 23.5, humidity: 45 },
    { sensorId: 'S002', calibrationTime: null, temperature: 24.0, humidity: 48 },
    { sensorId: 'S003', calibrationTime: '2024-01-15 10:00:00', temperature: 22.8, humidity: 50 }
  ];

  console.log('--- 第一步: 导入温度校准记录 ---');
  const step1 = await dataAccess.executeStep1(evaluationId, temperatureRecords);
  console.log(step1.message);
  console.log(`导入成功: ${step1.importResult.imported} 条\n`);

  const sensorRecords = [
    { sensorId: 'S001', siteStatement: '主设备区北侧，安装位置正确', installLocation: '主设备区-01', operator: '张三' },
    { sensorId: 'S002', siteStatement: '走廊区域，现场确认已校准', installLocation: '走廊-A区', operator: '李四' },
    { sensorId: 'S003', siteStatement: '机房内部，温度环境稳定', installLocation: '机房-02', operator: '王五' }
  ];

  console.log('--- 第二步: 训练教练老唐查看传感器编号 ---');
  const step2 = await dataAccess.executeStep2(evaluationId, sensorRecords, '老唐');
  console.log(step2.message);
  if (step2.alerts) {
    step2.alerts.forEach(a => console.log(`⚠️  ${a}`));
  }
  console.log('');

  console.log('--- 第三步: 实验复盘图更新 ---');
  const step3 = await dataAccess.executeStep3(evaluationId, {}, '系统');
  console.log(step3.message);
  console.log(`待质检员复核记录数: ${step3.recordsPendingQualityReview}\n`);

  console.log('--- 自检结果 ---');
  const status = dataAccess.getWorkflowStatus(evaluationId);
  console.log('重复导入检测:', status.selfCheckResults.duplicateImport.passed ? '通过' : '发现问题');
  console.log('采样时间检测:', status.selfCheckResults.missingSampleTime.passed ? '通过' : '发现问题');
  console.log('补录重算检测:', status.selfCheckResults.recalculationAfterSupplement.passed ? '通过' : '发现问题');
  console.log('导出一致性检测:', status.selfCheckResults.exportConsistency.passed ? '通过' : '发现问题');
  console.log('');

  console.log('--- 数据一致性验证（页面/接口/导出） ---');
  const consistency = dataAccess.verifyDataConsistency(evaluationId);
  console.log('数据一致性:', consistency.isConsistent ? '一致' : '不一致');
  console.log(`记录数: 页面=${consistency.checks.recordCount.display}, 接口=${consistency.checks.recordCount.api}, 导出=${consistency.checks.recordCount.export}`);
  console.log('');

  console.log('--- 导出明细数据 ---');
  const exportData = dataAccess.getResultsForExport(evaluationId);
  console.log(`导出记录数: ${exportData.details.length}`);
  exportData.details.forEach((r, i) => {
    console.log(`\n记录 ${i + 1}:`);
    console.log(`  原始行号: ${r.原始行号}`);
    console.log(`  传感器编号: ${r.传感器编号}`);
    console.log(`  现场说法: ${r.现场说法}`);
    console.log(`  采样时间缺失: ${r.采样时间缺失}`);
    console.log(`  需质检员复核: ${r.需质检员复核}`);
  });
  console.log('');

  console.log('--- 补录操作示例 ---');
  const results = dataAccess.getResultsForAPI(evaluationId);
  const pendingRecord = results.data.records.find(r => r.hasMissingSampleTime);
  if (pendingRecord) {
    console.log(`补录记录 ${pendingRecord.sourceLine} 行的采样时间...`);
    dataAccess.supplementData(
      evaluationId, 
      pendingRecord.id, 
      { calibrationTime: '2024-01-15 09:30:00' },
      '老唐',
      '补录缺失的采样时间'
    );
    console.log('补录完成，版本号已递增\n');
  }

  console.log('--- 审计追踪 ---');
  if (pendingRecord) {
    const audit = dataAccess.getAuditTrail(evaluationId, pendingRecord.id);
    console.log(`原始行号: ${audit.sourceLineNumber}`);
    console.log(`原始校准时间: ${audit.originalData.calibrationTime}`);
    console.log(`处理状态: ${audit.processingStatus}`);
    console.log('人工改动记录:');
    audit.manualChanges.forEach(c => {
      console.log(`  ${c.timestamp}: ${c.operator} 修改 ${c.field} (${c.reason})`);
    });
  }

  console.log('\n=== 示例完成 ===');
}

runExample().catch(console.error);
