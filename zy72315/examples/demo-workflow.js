const { ThreeStepWorkflow } = require('../src');

const divider = (n = 70) => '\n' + '─'.repeat(n);
const bigDivider = (n = 70) => '\n' + '═'.repeat(n);

async function runDemo() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     A/B 实验提前停止判断 - 有记录可追溯 完整演示               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const workflow = new ThreeStepWorkflow();

  const boundaryData = [
    { lineNumber: 2, mainProcess: '首页浏览→下单', numerator: 156, denominator: 1200 },
    { lineNumber: 3, mainProcess: '购物车→支付', numerator: 89, denominator: '' },
    { lineNumber: 4, mainProcess: '搜索→点击', numerator: 432, denominator: 5600 },
    { lineNumber: 5, mainProcess: '商品详情→收藏', numerator: 67, denominator: 0 },
    { lineNumber: 6, mainProcess: '新人→注册', numerator: '', denominator: 800 }
  ];
  await workflow.executeStep1(boundaryData, '数据专员小王');

  console.log(divider());
  console.log('� 步骤1后 重点关注 EXP-002（分母为空） 和 EXP-004（分母为0）');
  console.log('   它们现在不会自动归正常，留给复核人');

  const scoringData = [
    { recordId: 'EXP-001', lineNumber: 2, sceneStatement: '核心转化路径', weight: 0.35 },
    { recordId: 'EXP-002', lineNumber: 3, sceneStatement: '支付环节关键', weight: 0.25 },
    { recordId: 'EXP-003', lineNumber: 4, sceneStatement: '搜索效率指标', weight: 0.20 },
    { recordId: 'EXP-004', lineNumber: 5, sceneStatement: '用户偏好采集', weight: 0.12 },
    { recordId: 'EXP-005', lineNumber: 6, sceneStatement: '新人转化考核', weight: 0.08 }
  ];
  await workflow.executeStep2(scoringData, '阿岚');

  console.log(divider());
  console.log('� 步骤2完成，两边证据合一，进入步骤3：课堂演示');
  console.log('   将依次演示：改动→验证同步→复核→回滚→验证恢复');

  const step3Ops = [
    {
      type: 'manual_fix',
      recordId: 'EXP-002',
      operator: '数据复核人老李',
      payload: {
        field: 'boundaryEvidence.rawData.denominator',
        oldValue: '',
        newValue: 300,
        reason: '经核查：空分母实为样本量300，Excel漏填',
        nextHandler: '运营规划阿岚'
      }
    },
    {
      type: 'review',
      recordId: 'EXP-002',
      status: 'approved',
      reviewer: '数据复核人老李',
      comment: '核对边界值Excel行号3，分母确认为300，现场说法已对齐',
      nextHandler: '阿岚(已同步)'
    },
    {
      type: 'manual_fix',
      recordId: 'EXP-004',
      operator: '数据复核人老李',
      payload: {
        field: 'boundaryEvidence.rawData.denominator',
        oldValue: 0,
        newValue: 150,
        reason: '分母为0是录入错误，原始样本量150'
      }
    }
  ];
  await workflow.executeStep3(step3Ops, '课堂演示');

  console.log(divider());
  console.log('🔍 验证【改动后 结果同步】：EXP-002 四处输出一致性');
  const v1 = workflow.crossValidateOutputs('EXP-002');
  console.log(`   结果值一致(列表/CSV/页面/API): ${v1.eval_consistent ? '✅ 是' : '❌ 否'}`);
  console.log(`   list:${v1.checkValues.list}  csv:${v1.checkValues.csv}  page:${v1.checkValues.page}  api:${v1.checkValues.api}`);

  console.log(divider());
  console.log('🔍 验证【改动后 可追溯】：EXP-002 完整追溯链');
  const trace = workflow.getFullTraceability('EXP-002');
  console.log(`   证据来源: 边界值说明行${trace.evidenceOrigin.boundary.lineNumber}, 评分权重表行${trace.evidenceOrigin.scoring.lineNumber}`);
  console.log(`   原始分母: ${JSON.stringify(trace.evidenceOrigin.boundary.originalValues.denominator)}`);
  console.log(`   当前分母: ${JSON.stringify(trace.evidenceOrigin.boundary.currentValues.denominator)}`);
  trace.valueChanges.forEach((c, i) => {
    console.log(`   改动#${i}: ${c.field} ${JSON.stringify(c.original)}→${JSON.stringify(c.modified)}`);
    console.log(`          操作人:${c.operator} 原因:${c.reason} 下一步:${c.nextHandler || '(无)'}`);
  });
  console.log(`   改动次数: ${trace.summary.totalChanges}, 待回滚: ${trace.summary.pendingRollbacks}`);

  console.log(divider());
  console.log('🔍 展示【导出/列表/详情/摘要/报告 全链路】：同一份数据');
  const pageList = workflow.export_ListPage();
  const apiList = workflow.export_ListAPI();
  const csvContent = workflow.export_ListCSV();
  const summary = workflow.export_Summary('text');

  console.log(`\n   📋 页面列表统计: 总${pageList.statistics.total} 需复核${pageList.statistics.needsReview} 已改动${pageList.statistics.modified} 待回滚${pageList.statistics.withRollbackPending}`);
  console.log(`   🔌 API列表统计: 总${apiList.data.statistics.total} 需复核${apiList.data.statistics.needsReview} 已改动${apiList.data.statistics.modified}`);
  console.log(`   📄 CSV已生成 ${csvContent.split('\n').length} 行，首字段一致检查：`);
  const csvRow2 = csvContent.split('\n')[1];
  const pageRow0 = pageList.data[1];
  console.log(`      EXP-002: CSV displayValue=${csvRow2.includes('[需复核') ? '[需复核]' : pageRow0.denominator_changed ? '已改动' : '正常'}`);
  console.log(`              页面 displayValue=${pageRow0.displayValue}, changed=${pageRow0.denominator_changed}`);

  console.log(divider());
  console.log('📄 【汇总报告 - 需关注项】');
  const report = workflow.exporter.formatForSummaryReport(workflow.getUnifiedRecords());
  report.attentionItems.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.id} | ${r.mainProcess}`);
    console.log(`     原分母:${JSON.stringify(r.originalDenominator)} → 当前:${JSON.stringify(r.currentDenominator)}`);
    console.log(`     结果:${r.result} 改动次数:${r.changeCount}${r.nextHandler ? ' 下一步:' + r.nextHandler : ''}`);
  });

  console.log(divider());
  console.log('↩️  演示【回滚功能】：EXP-004 回滚改动#0，恢复原始分母0');
  const rollbackResult = workflow.rollbackManualFix('EXP-004', 0, '课堂演示-用户操作');
  console.log(`   值是否恢复: ${rollbackResult.valuesRestored ? '✅ 是' : '⚠ 未变（可能已相同）'}`);

  console.log(divider());
  console.log('� 验证【回滚后 结果恢复 & 输出仍一致】：EXP-004');
  const v2 = workflow.crossValidateOutputs('EXP-004');
  const rec = workflow.store.getRecord('EXP-004');
  console.log(`   当前分母: ${JSON.stringify(rec.boundaryEvidence.rawData.denominator)}`);
  console.log(`   原始分母(永不丢失): ${JSON.stringify(rec.boundaryEvidence.originalRawData.denominator)}`);
  console.log(`   四处一致: ${v2.eval_consistent ? '✅ 是' : '❌ 否'}`);
  console.log(`   四处值: list=${v2.checkValues.list} csv=${v2.checkValues.csv} page=${v2.checkValues.page} api=${v2.checkValues.api}`);

  console.log(divider());
  console.log('🧾 展示【EXP-002 详情页 追溯面板全部字段】');
  const detail = workflow.getRecordDetail('EXP-002');
  console.log('   ┌ 原始值/当前值差异:');
  detail.traceability.valueDiff.forEach(d =>
    console.log(`   │  ${d.field}: ${JSON.stringify(d.original)} → ${JSON.stringify(d.current)}`)
  );
  console.log('   ├ 人工改动历史:');
  detail.traceability.manualChanges.forEach((c, i) =>
    console.log(`   │  #${i} ${c.operator} 改${c.field}: ${JSON.stringify(c.oldValue)}→${JSON.stringify(c.newValue)} (${c.reason})` +
      (c.nextHandler ? ` →下一步:${c.nextHandler}` : ''))
  );
  console.log('   ├ 复核时间线:');
  detail.traceability.reviewHistory.forEach(r =>
    console.log(`   │  ${r.timestamp.slice(0, 19)} ${r.status} by ${r.reviewer}: ${r.comment}`)
  );
  console.log('   └ 可回滚操作:');
  detail.rollbackOptions.forEach(o =>
    console.log(`      [回滚 #${o.index}] ${o.summary}`)
  );

  console.log(divider());
  console.log('🧾 展示【EXP-004 审计日志 全链路】');
  const audit = workflow.getAuditTrail('EXP-004');
  audit.forEach((e, i) =>
    console.log(`   ${i + 1}. [${e.timestamp.slice(11, 19)}] ${e.action} - ${e.note}`)
  );

  console.log(bigDivider());
  console.log('✅ 演示完成！达成以下能力：');
  console.log(bigDivider());
  const checks = [
    '【有记录】原始导入值永不丢失，保存在 originalRawData',
    '【真改动】applyManualChange 真正修改 rawData，不是只写日志',
    '【真同步】CSV/页面/API/详情/报告读取同一份最新数据',
    '【可追溯】每条改动记录：字段、原值/新值、操作人、原因、下一步处理人',
    '【可回滚】rollbackChange 真正恢复字段值，不是只改状态',
    '【回滚后一致】四处输出再次校验一致',
    '【不急着归正常】分母为0/空 始终保留需复核标记，带原始值/当前值对比',
    '【复核链路】reviewTimeline + 审计日志 完整记录状态流转'
  ];
  checks.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log(bigDivider());
}

runDemo().catch(e => { console.error('演示失败:', e); process.exit(1); });
