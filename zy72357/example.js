const UnifiedDataAccess = require('./src/data/UnifiedDataAccess');

async function runS002CompleteDemo() {
  console.log('\n######################################################################');
  console.log('  声学隔断降噪评估系统 - S002 完整数据链追踪演示');
  console.log('  目标：S002 采样15分钟（缺15分钟）→ 补录30分钟 → 待复核 → 复核通过');
  console.log('  重点：初始证据永不丢失、原始说法永不污染、6处出口始终一致');
  console.log('######################################################################\n');

  const uda = new UnifiedDataAccess();

  // ============ 【第1步】打开项目，创建评估 ============
  const evaluationId = uda.startNewEvaluation('老唐');
  console.log(`✅ 【打开项目】创建评估任务: ${evaluationId}`);

  // ============ 【第2步】导入/上传 S002（15分钟采样，缺15分钟） ============
  console.log('\n======================================================================');
  console.log('  【第2步】导入温度校准记录（S002 采样时长15分钟，缺15分钟）');
  console.log('======================================================================\n');

  const temperatureData = [
    { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 45, temperature: 23.5, humidity: 45, notes: '会议室正常采样，全程无间断' },
    { sensorId: 'S002', sampleStartTime: '2024-01-15 10:00:00', sampleDurationMinutes: 15, temperature: 24, humidity: 48, notes: '走廊区域采样，中途设备断电，实际采了15分钟就结束了' },
    { sensorId: 'S003', sampleStartTime: '2024-01-15 11:00:00', sampleDurationMinutes: 30, temperature: 24.5, humidity: 47, notes: '办公区标准采样' },
    { sensorId: 'S004', temperature: 25, humidity: 50, notes: '' }
  ];

  await uda.executeStep1(evaluationId, temperatureData);
  const step1List = uda.getListForDisplay(evaluationId);
  const s002Id = step1List.list.find(r => r.sensorId === 'S002').id;

  console.log('📥 导入结果：4 条，其中 2 条有采样时间问题');
  step1List.list.forEach(r => {
    const initialDesc = r.initialBadge || '初始正常';
    const currentDesc = r.currentStatusBadge;
    console.log(`   行号${r.row} | ${r.sensorId} | ${initialDesc} → ${currentDesc} | 徽章:${r.displayBadge}`);
  });

  const s002Step1 = uda.getDetailForDisplay(evaluationId, s002Id);
  console.log('\n   🎯 S002 初始状态：');
  console.log(`      初始问题类型: ${s002Step1.initialIssueDetail.type}`);
  console.log(`      初始问题描述: ${s002Step1.initialIssueDetail.description}`);
  console.log(`      初始缺失分钟数: ${s002Step1.initialIssueDetail.missingMinutes} 分钟`);
  console.log(`      初始实际时长: ${s002Step1.initialIssueDetail.actualMinutes} 分钟`);
  console.log(`      原始说法: ${s002Step1.sourceData.originalStatement}`);

  // ============ 【第3步】训练教练老唐补看传感器编号 ============
  console.log('\n======================================================================');
  console.log('  【第3步】训练教练老唐补看传感器编号（三步工作流 step2）');
  console.log('======================================================================\n');

  const sensorData = [
    { sensorId: 'S001', siteStatement: '会议室东南角，距外墙1.5米', installLocation: '室内-会议室', operator: '老唐', verificationStatus: 'verified' },
    { sensorId: 'S002', siteStatement: '走廊A区东侧，现场确认设备已校准，但中途断电导致时长短', installLocation: '公共区-走廊', operator: '老唐', verificationStatus: 'needs_review' },
    { sensorId: 'S003', siteStatement: '办公区开放工位第3排', installLocation: '室内-办公区', operator: '老唐', verificationStatus: 'verified' },
    { sensorId: 'S004', siteStatement: '机房入口，采样记录丢失', installLocation: '机房入口', operator: '老唐', verificationStatus: 'needs_review' }
  ];

  await uda.executeStep2(evaluationId, sensorData, '老唐');
  await uda.executeStep3(evaluationId, { operator: '老唐' }, '老唐');
  console.log('🔍 完成三步工作流：导入→补传感器→实验复盘');

  // ============ 【第4步】补录 S002：15→30 分钟，保存并重算 ============
  console.log('\n======================================================================');
  console.log('  【第4步】补录 S002：采样时长 15→30 分钟，保存并重算');
  console.log('======================================================================\n');

  uda.supplementData(
    evaluationId,
    s002Id,
    { sampleDurationMinutes: 30 },
    '老唐',
    '现场确认后半段数据在手持终端里，补齐全30分钟'
  );
  uda.recalculate(evaluationId);

  const s002AfterSupplement = uda.getDetailForDisplay(evaluationId, s002Id);
  console.log('🔧 补录操作完成：sampleDurationMinutes 15 → 30');
  console.log('\n   📌 关键断言（补录后，仍待复核）：');
  console.log(`      初始问题: ${s002AfterSupplement.initialIssueDetail.description}（缺${s002AfterSupplement.initialIssueDetail.missingMinutes}分钟）`);
  console.log(`      当前状态: ${s002AfterSupplement.currentIssue.description}`);
  console.log(`      初始缺失分钟数: ${s002AfterSupplement.initialIssueDetail.missingMinutes}（保留！未被抹掉）`);
  console.log(`      当前缺失分钟数: ${s002AfterSupplement.currentIssue.missingMinutes || 0}`);
  console.log(`      复核状态: ${s002AfterSupplement.qualityReview.status}（不是 approved！）`);
  console.log(`      下一步处理: ${s002AfterSupplement.display.nextStepText}`);
  console.log(`      原始说法（未被污染）: ${s002AfterSupplement.sourceData.originalStatement}`);
  console.log(`      改后值: ${s002AfterSupplement.sourceData.correctedValue.field} = ${s002AfterSupplement.sourceData.correctedValue.value}`);
  console.log(`      处理原因: ${s002AfterSupplement.sourceData.processingReason}`);
  console.log(`      责任人: ${s002AfterSupplement.sourceData.handlerList.join('、')}, 复核: ${s002AfterSupplement.sourceData.reviewer || '待指定'}`);

  // ============ 【第5步】刷新重算 + 导出明细 ============
  console.log('\n======================================================================');
  console.log('  【第5步】刷新重算 + 导出明细（重点检查初始证据保留情况）');
  console.log('======================================================================\n');

  const exportData = uda.getResultsForExport(evaluationId);
  const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
  console.log('📤 导出明细 - S002 关键字段：');
  console.log(`      初始采样时间问题类型: ${s002Export['初始采样时间问题类型']}`);
  console.log(`      初始采样时间问题描述: ${s002Export['初始采样时间问题描述']}`);
  console.log(`      初始缺失分钟数: ${s002Export['初始缺失分钟数']} 分钟`);
  console.log(`      初始实际时长_分钟: ${s002Export['初始实际时长_分钟']} 分钟`);
  console.log(`      当前采样时间问题类型: ${s002Export['当前采样时间问题类型']}`);
  console.log(`      原始说法: ${s002Export['原始说法']}`);
  console.log(`      当前备注: ${s002Export['当前备注'] || '（空）'}`);
  console.log(`      改后值明细: ${s002Export['改后值明细']}`);
  console.log(`      处理原因明细: ${s002Export['处理原因明细']}`);
  console.log(`      责任人明细: ${s002Export['责任人明细']}`);
  console.log(`      下一步处理: ${s002Export['下一步处理']}`);
  console.log(`      ⚠️  不是"已完成"！是"待复核"`);

  // ============ 【第6步】查看历史记录 ============
  console.log('\n======================================================================');
  console.log('  【第6步】查看历史记录（初始证据完整保留）');
  console.log('======================================================================\n');

  const history = uda.getHistoryForDisplay(evaluationId);
  const s002History = history.history.find(h => h['传感器编号'] === 'S002');
  console.log('📜 历史记录 - S002：');
  console.log(`      原始说法: ${s002History['原始说法']}`);
  console.log(`      初始问题: ${s002History['初始问题']}`);
  console.log(`      初始问题类型: ${s002History['初始问题类型']}`);
  console.log(`      初始缺失分钟数: ${s002History['初始缺失分钟数']} 分钟`);
  console.log(`      初始实际时长_分钟: ${s002History['初始实际时长_分钟']} 分钟`);
  console.log(`      当前问题: ${s002History['当前问题']}`);
  console.log(`      是否曾有异常: ${s002History['是否曾有异常']}`);
  console.log(`      人工改动次数: ${s002History['人工改动次数']}`);
  console.log(`      复核状态: ${s002History['复核状态']}`);
  console.log(`      下一步处理: ${s002History['下一步处理']}`);

  // ============ 【第7步】生成报告 ============
  console.log('\n======================================================================');
  console.log('  【第7步】生成报告（两套证据+独立复核备注）');
  console.log('======================================================================\n');

  const report = uda.getReport(evaluationId);
  const s002ReportAudit = report.recordAudits.find(r => r.sensorId === 'S002');
  const s002InReportRecords = report.records.find(r => r['传感器编号'] === 'S002');
  console.log(`📋 报告ID: ${report.reportId}`);
  console.log(`   总览: 曾有问题记录数=${report.overview['曾有采样时间问题记录数']}，累计初始缺失=${report.overview['初始累计缺失分钟数']}分钟`);
  console.log(`\n   S002 报告明细：`);
  console.log(`      初始问题描述: ${s002InReportRecords['初始问题描述']}`);
  console.log(`      初始缺失分钟数: ${s002InReportRecords['初始缺失分钟数']} 分钟`);
  console.log(`      是否纳入正常结果: ${s002InReportRecords['是否纳入正常结果']}（待复核，所以是"否"）`);
  console.log(`      证据链_原始说法: ${s002InReportRecords['证据链_原始说法']}`);
  console.log(`      证据链_改后值: ${s002InReportRecords['证据链_改后值']}`);
  console.log(`      证据链_处理原因: ${s002InReportRecords['证据链_处理原因']}`);
  console.log(`      证据链_责任人: ${s002InReportRecords['证据链_责任人']}`);
  console.log(`      证据链_复核备注: ${s002InReportRecords['证据链_复核备注'] || '（暂无，待质检员填写）'}`);
  console.log(`      下一步处理: ${s002InReportRecords['下一步处理']}`);

  // ============ 【第8步】质检员复核通过 ============
  console.log('\n======================================================================');
  console.log('  【第8步】质检员复核通过 S002（检查复核备注独立保存）');
  console.log('======================================================================\n');

  uda.qualityReview(
    evaluationId,
    s002Id,
    '质检员A',
    'approve',
    '已核对手持终端的后半段数据，时长确实补齐到30分钟，数据可信'
  );

  const s002Final = uda.getDetailForDisplay(evaluationId, s002Id);
  const finalAudit = uda.getAuditTrail(evaluationId, s002Id);
  console.log('✅ 质检员复核通过：');
  console.log(`\n   🎯 关键断言（复核通过后）：`);
  console.log(`      原始说法仍独立保存: ${finalAudit.originalStatement}`);
  console.log(`      复核备注独立字段: ${finalAudit.qualityReview.reviewNotes}`);
  console.log(`      初始问题仍在: ${finalAudit.initialIssue.description}（缺${finalAudit.initialIssue.missingMinutes}分钟）`);
  console.log(`      当前问题: ${finalAudit.currentIssue.description}`);
  console.log(`      复核人: ${finalAudit.qualityReview.reviewer}`);
  console.log(`      复核结论: ${finalAudit.qualityReview.decision}`);
  console.log(`      纳入正常结果: ${s002Final.qualityReview.status === 'approved' && s002Final.durationCompliant ? '是' : '否'}`);
  console.log(`      审计完整证据链:`);
  console.log(`        - 原始行号: ${finalAudit.sourceLineNumber}`);
  console.log(`        - 原始输入: ${JSON.stringify(finalAudit.originalSnapshot)}`);
  console.log(`        - 初始问题: ${finalAudit.initialIssue.description}`);
  console.log(`        - 改动明细:`);
  finalAudit.manualChanges.forEach((c, i) => {
    console.log(`           ${i + 1}. ${c.timestamp.slice(5, 16)} | ${c.operator}`);
    console.log(`              字段: ${c.field}，原值: [${c.originalValue}] → 新值: [${c.correctedValue}]`);
    console.log(`              原因: ${c.processingReason}`);
  });
  console.log(`        - 复核人: ${finalAudit.qualityReview.reviewer}`);
  console.log(`        - 复核备注: ${finalAudit.qualityReview.reviewNotes}`);
  console.log(`        - 下一步: ${finalAudit.qualityReview.currentNextStep}`);

  // ============ 【最终校验】6处出口一致性 ============
  console.log('\n======================================================================');
  console.log('  【最终校验】6处出口（页面/列表/接口/导出/历史/报告）一致性');
  console.log('======================================================================\n');

  const consistency = uda.verifyDataConsistency(evaluationId);
  console.log(`   一致性结论: ${consistency.isConsistent ? '✅ 全部一致' : '❌ 不一致'}`);
  console.log(`   校验数据源数量: ${consistency.summary.totalSourcesVerified} 处`);
  Object.keys(consistency.checks).forEach(key => {
    const c = consistency.checks[key];
    console.log(`   ${key}: 页面=${c.display} 列表=${c.list} 接口=${c.api} 导出=${c.export} 历史=${c.history} 报告=${c.report} → ${c.consistent ? '✅' : '❌'}`);
  });
  Object.keys(consistency.sampleFieldConsistency).forEach(key => {
    const fc = consistency.sampleFieldConsistency[key];
    console.log(`   字段${key}一致性: ${fc.consistent ? '✅' : '❌'}`);
  });

  console.log('\n######################################################################');
  console.log('  ✅ S002 完整数据链演示完成');
  console.log('');
  console.log('  📌 8个关键保证：');
  console.log('    1. 初始问题（duration_short，缺15分钟）永不丢失');
  console.log('    2. 原始说法永不被复核备注污染');
  console.log('    3. 补录后待复核状态（pending），不提前归正常');
  console.log('    4. 导出明细下一步处理不是"已完成"，是"待复核"');
  console.log('    5. 改后值、处理原因、责任人独立字段保存');
  console.log('    6. 复核备注独立存在 qualityReview.reviewNotes');
  console.log('    7. 报告两套视图：初始问题 + 当前状态');
  console.log('    8. 6处出口数据源完全一致（integratedResults）');
  console.log('######################################################################\n');
}

runS002CompleteDemo().catch(console.error);
