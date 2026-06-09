const { UnifiedDataAccess } = require('./src');
const moment = require('moment');

function printSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function printSubSection(title) {
  console.log('\n' + '-'.repeat(60));
  console.log(`  ${title}`);
  console.log('-'.repeat(60));
}

async function runExample() {
  console.log('\n' + '#'.repeat(70));
  console.log('  声学隔断降噪评估系统 - 完整操作路示例');
  console.log('  重点场景：采样时间缺了半小时（不是空值，是时长15分钟）');
  console.log('#'.repeat(70));

  const dataAccess = new UnifiedDataAccess();
  const evaluationId = dataAccess.startNewEvaluation('老唐');
  console.log(`\n✅ 创建评估任务: ${evaluationId}`);

  printSection('第一步：导入温度校准记录（包含采样时长缺半小时的记录）');

  const temperatureRecords = [
    { 
      sensorId: 'S001', 
      sampleStartTime: '2024-01-15 09:00:00', 
      sampleDurationMinutes: 30, 
      temperature: 23.5, 
      humidity: 45, 
      notes: '主设备区正常采样30分钟，设备稳定'
    },
    { 
      sensorId: 'S002', 
      sampleStartTime: '2024-01-15 10:00:00', 
      sampleDurationMinutes: 15, 
      temperature: 24.0, 
      humidity: 48, 
      notes: '走廊区域采样，中途设备断电，实际采了15分钟就结束了'
    },
    { 
      sensorId: 'S003', 
      sampleStartTime: '2024-01-15 11:00:00', 
      sampleDurationMinutes: 30, 
      temperature: 22.8, 
      humidity: 50, 
      notes: '机房内采样，空调环境稳定'
    },
    { 
      sensorId: 'S004', 
      calibrationTime: null, 
      temperature: 25.0, 
      humidity: 52, 
      notes: '仓库采样，现场忙忘了记采样时间'
    }
  ];

  const step1 = await dataAccess.executeStep1(evaluationId, temperatureRecords);
  console.log(`\n📥 ${step1.message}`);
  console.log(`   导入总数: ${step1.importResult.imported} 条`);
  console.log(`   ⚠️  有采样时间问题: ${step1.importResult.recordsWithMissingTime} 条`);

  printSubSection('自检：采样时间问题明细');
  const statusAfterStep1 = dataAccess.getWorkflowStatus(evaluationId);
  statusAfterStep1.selfCheckResults.missingSampleTime.details.forEach(d => {
    console.log(`   行号${d.sourceLineNumber} | 传感器${d.sensorId} | ${d.issue}`);
    if (d.issueType === 'duration_short') {
      console.log(`     → 实际${d.actualMinutes}分钟，缺${d.missingMinutes}分钟，严重程度: ${d.severity}`);
    }
  });

  printSection('第二步：训练教练老唐查看传感器编号（补充现场说法）');

  const sensorRecords = [
    { 
      sensorId: 'S001', 
      siteStatement: '主设备区北侧，安装位置正确，底座稳固，周边无遮挡', 
      installLocation: '主设备区-01', 
      operator: '张三'
    },
    { 
      sensorId: 'S002', 
      siteStatement: '走廊A区东侧，现场确认设备已校准，但中途断电导致时长短', 
      installLocation: '走廊-A区', 
      operator: '李四'
    },
    { 
      sensorId: 'S003', 
      siteStatement: '机房内部机柜旁，温度环境稳定，空调24小时运行', 
      installLocation: '机房-02', 
      operator: '王五'
    },
    { 
      sensorId: 'S004', 
      siteStatement: '仓库B1角落，采样时忘记记录时间，需要补录', 
      installLocation: '仓库-B1', 
      operator: '赵六'
    }
  ];

  const step2 = await dataAccess.executeStep2(evaluationId, sensorRecords, '老唐');
  console.log(`\n🔍 ${step2.message}`);
  console.log(`   关联传感器: ${step2.sensorResult.imported} 个`);
  step2.alerts.forEach(a => console.log(`   ⚠️  ${a}`));

  printSection('第三步：实验复盘图更新（采样时间缺半小时不自动归正常，留给质检员）');

  const step3 = await dataAccess.executeStep3(evaluationId, {}, '系统');
  console.log(`\n📊 ${step3.message}`);
  console.log(`   📋 待质检员复核记录数: ${step3.recordsPendingQualityReview}`);
  console.log(`   当前阶段: ${step3.currentStage}`);
  console.log(`   可用操作: ${step3.availableActions.join(' | ')}`);

  printSubSection('6处数据源一致性校验（页面/列表/接口/导出/历史/报告）');
  const consistency = dataAccess.verifyDataConsistency(evaluationId);
  console.log(`   校验结果: ${consistency.isConsistent ? '✅ 全部一致' : '❌ 不一致'}`);
  console.log(`   校验数据源数量: ${consistency.summary.totalSourcesVerified} 处`);
  console.log(`   记录数: 页面=${consistency.checks.recordCount.display} 列表=${consistency.checks.recordCount.list} 接口=${consistency.checks.recordCount.api} 导出=${consistency.checks.recordCount.export} 历史=${consistency.checks.recordCount.history} 报告=${consistency.checks.recordCount.report}`);

  printSection('触发问题的输入 → 补录动作 → 状态变化 → 最终展示（同一条记录追踪）');

  const resultsBefore = dataAccess.getResultsForAPI(evaluationId);
  const targetRecordBefore = resultsBefore.data.records.find(r => r.sensorId === 'S002');
  const recordId = targetRecordBefore.id;

  printSubSection('【1】触发问题的原始输入（S002，走廊采样，时长15分钟）');
  console.log(`   原始行号: ${targetRecordBefore.sourceLine}`);
  console.log(`   原始说法: ${targetRecordBefore.siteStatement}`);
  console.log(`   采样开始: ${targetRecordBefore.sampleStartTime}`);
  console.log(`   采样时长: ${targetRecordBefore.sampleDurationMinutes} 分钟`);
  console.log(`   问题类型: ${targetRecordBefore.sampleTimeIssue.type}`);
  console.log(`   问题描述: ${targetRecordBefore.sampleTimeIssue.description}`);
  console.log(`   缺失分钟数: ${targetRecordBefore.sampleTimeIssue.missingMinutes}`);
  console.log(`   当前处理状态: ${targetRecordBefore.processingStatus}`);
  console.log(`   复核状态: ${targetRecordBefore.qualityReview.status}`);
  console.log(`   下一步找谁: ${targetRecordBefore.qualityReview.nextHandler}`);
  console.log(`   下一步处理: ${targetRecordBefore.qualityReview.nextStepDescription}`);

  printSubSection('【2】补录动作（老唐补录S002采样时长到30分钟）');
  console.log('   操作人: 老唐');
  console.log('   修改字段: sampleDurationMinutes (15 → 30)');
  console.log('   原因: 现场确认后半段数据在手持终端里，补齐全30分钟');

  const supplementResult = dataAccess.supplementData(
    evaluationId, 
    recordId, 
    { sampleDurationMinutes: 30 }, 
    '老唐', 
    '现场确认后半段数据在手持终端里，补齐全30分钟'
  );

  dataAccess.recalculate(evaluationId);

  printSubSection('【3】保存后的状态变化（仍需质检员复核，不提前归正常）');
  const resultsAfter = dataAccess.getResultsForAPI(evaluationId);
  const targetRecordAfter = resultsAfter.data.records.find(r => r.id === recordId);

  console.log(`   版本号: v${resultsBefore.data.version} → v${resultsAfter.data.version}`);
  console.log(`   采样时长: ${targetRecordBefore.sampleDurationMinutes} → ${targetRecordAfter.sampleDurationMinutes} 分钟`);
  console.log(`   处理状态: ${targetRecordBefore.processingStatus} → ${targetRecordAfter.processingStatus}`);
  console.log(`   ⚠️  复核状态: 仍为 ${targetRecordAfter.qualityReview.status}（需要质检员确认，不自动归正常）`);
  console.log(`   下一步找谁: ${targetRecordAfter.qualityReview.nextHandler}`);
  console.log(`   下一步处理: ${targetRecordAfter.qualityReview.nextStepDescription}`);

  printSubSection('【4】最终展示（页面/接口/导出/报告/历史 全部同步）');
  const display = dataAccess.getListForDisplay(evaluationId);
  const displayRecord = display.list.find(r => r.sensorId === 'S002');
  console.log(`   📱 页面列表: 行号${displayRecord.row} | ${displayRecord.issueText} | 徽章: ${displayRecord.displayBadge} | 下一步: ${displayRecord.nextStep}`);

  const exportData = dataAccess.getResultsForExport(evaluationId);
  const exportRecord = exportData.details.find(r => r.传感器编号 === 'S002');
  console.log(`   📤 导出明细: ${exportRecord.采样时间问题描述} | 复核: ${exportRecord.需质检员复核} | 下一步: ${exportRecord.下一步处理}`);

  const historyRecord = exportData.history.find(h => h.传感器编号 === 'S002');
  console.log(`   📜 历史记录: 原始说法: ${historyRecord.原始说法.slice(0, 30)}... | 缺失${historyRecord.缺失分钟数}分钟 | 最后改动: ${historyRecord.最后一次改动}`);

  const report = dataAccess.getReport(evaluationId);
  const reportRecord = report.recordAudits.find(r => r.sensorId === 'S002');
  console.log(`   📋 正式报告: 是否纳入正常结果: ${reportRecord.isInNormalResults ? '是' : '否'} | 复核人: ${reportRecord.review.reviewer || '待指定'}`);

  const detail = dataAccess.getDetailForDisplay(evaluationId, recordId);
  console.log(`   📄 详情页证据链: 原始行号${detail.sourceData.originalRow} | 改后值: ${detail.sourceData.correctedValue.field}=${detail.sourceData.correctedValue.value} | 处理原因: ${detail.sourceData.processingReason} | 下一步找: ${detail.sourceData.nextHandler}`);

  printSection('质检员复核操作（确认补录有效后，才能归到正常结果）');

  printSubSection('【5】质检员复核通过 S002');
  const reviewResult = dataAccess.qualityReview(
    evaluationId,
    recordId,
    '质检员A',
    'approve',
    '已核对手持终端的后半段数据，时长确实补齐到30分钟，数据可信'
  );

  console.log(`   复核人: ${reviewResult.qualityReview.reviewer}`);
  console.log(`   复核结论: 通过 (approve)`);
  console.log(`   复核备注: ${reviewResult.qualityReview.reviewNotes}`);
  console.log(`   ✅ 复核状态: ${reviewResult.qualityReview.status}`);
  console.log(`   最终处理状态: ${reviewResult.processingStatus}`);
  console.log(`   时长是否达标: ${reviewResult.durationCompliant ? '是' : '否'}`);

  printSubSection('【6】复核后的最终一致性校验');
  const finalConsistency = dataAccess.verifyDataConsistency(evaluationId);
  console.log(`   6处数据源一致性: ${finalConsistency.isConsistent ? '✅ 全部一致' : '❌ 不一致'}`);

  const finalResults = dataAccess.getResultsForAPI(evaluationId);
  console.log(`\n   📊 最终汇总:`);
  console.log(`      总记录数: ${finalResults.data.summary.totalRecords}`);
  console.log(`      持续时间达标: ${finalResults.data.summary.durationBreakdown.compliant} 条`);
  console.log(`      时长不足(缺半小时等): ${finalResults.data.summary.durationBreakdown.duration_short} 条`);
  console.log(`      时间完全为空: ${finalResults.data.summary.durationBreakdown.empty} 条`);
  console.log(`      需待复核: ${finalResults.data.summary.recordsPendingReview} 条`);
  console.log(`      复核通过: ${finalResults.data.summary.recordsApproved} 条`);
  console.log(`      复核未通过: ${finalResults.data.summary.recordsRejected} 条`);
  console.log(`      关联传感器: ${finalResults.data.summary.linkedSensors} 个`);
  console.log(`      数据一致性: ${finalResults.data.summary.consistency.guaranteedBy}`);

  printSection('完整审计追踪（质检员追问时可回到证据）');
  const auditTrail = dataAccess.getAuditTrail(evaluationId, recordId);
  console.log(`\n   原始行号: ${auditTrail.sourceLineNumber}`);
  console.log(`   原始输入:`, JSON.stringify(auditTrail.originalData, null, 6).replace(/\n/g, '\n   '));
  console.log(`   原始说法: ${auditTrail.originalStatement}`);
  console.log(`   初始问题: ${auditTrail.sampleTimeIssue.description}`);
  console.log(`\n   人工改动记录:`);
  auditTrail.manualChanges.forEach((c, i) => {
    console.log(`     ${i + 1}. ${moment(c.timestamp).format('MM-DD HH:mm:ss')} | ${c.operator}`);
    console.log(`        字段: ${c.field}`);
    console.log(`        原值: [${c.originalValue}] → 新值: [${c.correctedValue}]`);
    console.log(`        原因: ${c.processingReason}`);
  });
  console.log(`\n   复核信息:`);
  console.log(`     状态: ${auditTrail.qualityReview.status}`);
  console.log(`     复核人: ${auditTrail.qualityReview.reviewer}`);
  console.log(`     复核结论: ${auditTrail.qualityReview.decision}`);
  console.log(`     复核备注: ${auditTrail.qualityReview.reviewNotes}`);
  console.log(`     当前步骤: ${auditTrail.qualityReview.currentNextStep}`);
  console.log(`\n   一句话摘要: ${auditTrail.summary}`);

  console.log('\n' + '#'.repeat(70));
  console.log('  ✅ 操作路完整示例完成');
  console.log('  关键保证：');
  console.log('  1. 采样时长15分钟触发异常（不只是空值）');
  console.log('  2. 补录后仍需质检员复核，不提前归正常');
  console.log('  3. 页面/列表/接口/导出/历史/报告 6处数据源完全一致');
  console.log('  4. 完整证据链：原始行号+原始说法+改后值+原因+下一步找谁');
  console.log('#'.repeat(70) + '\n');
}

runExample().catch(err => {
  console.error('❌ 执行出错:', err);
  process.exit(1);
});
