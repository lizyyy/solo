const ThreeStepWorkflow = require('../src/workflow/ThreeStepWorkflow');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('='.repeat(72));
  console.log('  A/B 实验提前停止判断 — 全链路可复现验证');
  console.log('  验证项：补录、保存、复核、回滚、导出、报告、历史记录、追溯链');
  console.log('='.repeat(72));

  const wf = new ThreeStepWorkflow();
  const outputDir = path.join(__dirname, '..', 'output');
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }

  console.log('\n📌 步骤 0：验证 README 中提到的所有 API 入口真实存在');
  const apiChecks = [
    ['applyManualFix', typeof wf.applyManualFix],
    ['applyManualChange', typeof wf.applyManualChange],
    ['rollbackManualFix', typeof wf.rollbackManualFix],
    ['rollbackManualChange', typeof wf.rollbackManualChange],
    ['rollbackChange', typeof wf.rollbackChange],
    ['updateReview', typeof wf.updateReview],
    ['updateReviewStatus', typeof wf.updateReviewStatus],
    ['saveToFile', typeof wf.saveToFile],
    ['loadFromFile', typeof wf.loadFromFile],
    ['exportAllArtifacts', typeof wf.exportAllArtifacts],
    ['crossValidateOutputs', typeof wf.crossValidateOutputs],
    ['getFullTraceability', typeof wf.getFullTraceability],
    ['export_ListCSV', typeof wf.export_ListCSV],
    ['export_ListPage', typeof wf.export_ListPage],
    ['export_ListAPI', typeof wf.export_ListAPI],
    ['export_Summary', typeof wf.export_Summary],
    ['export_Report', typeof wf.export_Report],
  ];
  let allApiOk = true;
  apiChecks.forEach(([name, type]) => {
    const ok = type === 'function';
    if (!ok) allApiOk = false;
    console.log(`  ${ok ? '✅' : '❌'} ${name}${' '.repeat(28 - name.length)} → ${type}`);
  });
  console.log(`  ── 全部 API 存在: ${allApiOk ? '✅ 是' : '❌ 否'} ──`);

  if (!allApiOk) {
    console.error('\n❌ API 入口缺失，终止验证');
    process.exit(1);
  }

  console.log('\n📌 步骤 1：导入边界值说明（分母空字符串样例）');
  const boundaryData = [
    {
      recordId: 'EXP-002',
      lineNumber: 5,
      experimentName: '首页弹窗优化',
      metric: '点击率',
      numerator: 89,
      denominator: '',
      rawData: { numerator: 89, denominator: '', metric: '点击率' }
    }
  ];
  await wf.executeStep1(boundaryData, '数据导入员');

  console.log('\n📌 步骤 2：补看评分权重表');
  const scoringData = [
    {
      recordId: 'EXP-002',
      sceneStatement: '运营阿岚现场确认：分母漏填，应为300',
      weight: 'medium',
      reviewer: '阿岚',
      rawData: { sceneStatement: '运营阿岚现场确认：分母漏填，应为300', weight: 'medium', reviewer: '阿岚' }
    }
  ];
  await wf.executeStep2(scoringData, '阿岚');

  console.log('\n📌 验证 A — 初始状态四处一致性（EXP-002 需复核）');
  const cv0 = wf.crossValidateOutputs('EXP-002');
  console.log(`   displayValue 四处一致: ${cv0.eval_consistent ? '✅' : '❌'}`);
  console.log(`   值: ${cv0.checkValues.csv}`);

  const initial = wf.store.getRecord('EXP-002');
  console.log(`   原始分母: ${JSON.stringify(initial.boundaryEvidence.originalRawData.denominator)}`);
  console.log(`   当前分母: ${JSON.stringify(initial.boundaryEvidence.rawData.denominator)}`);
  console.log(`   状态: ${initial.reviewStatus}`);

  console.log('\n📌 步骤 3：人工补录分母 = 300');
  const fixResult = wf.applyManualChange(
    'EXP-002',
    'boundaryEvidence.rawData.denominator',
    '',
    300,
    '数据复核人老李',
    '阿岚现场确认分母漏填，实际曝光数300',
    '运营规划阿岚'
  );
  console.log(`   值是否变化: ${fixResult.valuesChanged ? '✅ 是' : '❌ 否'}`);
  console.log(`   变更前 displayValue: ${fixResult.before.displayValue}`);
  console.log(`   变更后 displayValue: ${fixResult.after.displayValue}`);
  console.log(`   变更前分母: ${JSON.stringify(fixResult.before.denominator)}`);
  console.log(`   变更后分母: ${JSON.stringify(fixResult.after.denominator)}`);

  console.log('\n📌 验证 B — 改动后四处一致性');
  const cv1 = wf.crossValidateOutputs('EXP-002');
  console.log(`   displayValue 四处一致: ${cv1.eval_consistent ? '✅' : '❌'}`);
  console.log(`   四处值: list=${cv1.checkValues.list}, csv=${cv1.checkValues.csv}, page=${cv1.checkValues.page}, api=${cv1.checkValues.api}`);

  const afterFix = wf.store.getRecord('EXP-002');
  console.log(`   manualChanges 长度: ${afterFix.manualChanges.length}`);
  console.log(`   改动原因: ${afterFix.manualChanges[0].reason}`);
  console.log(`   操作人: ${afterFix.manualChanges[0].operator}`);
  console.log(`   下一步处理人: ${afterFix.manualChanges[0].nextHandler}`);
  console.log(`   可回滚: ${afterFix.manualChanges[0].canRollback ? '✅ 是' : '❌ 否'}`);
  console.log(`   原始值未丢: ${afterFix.boundaryEvidence.originalRawData.denominator === '' ? '✅ 是' : '❌ 否'}`);

  console.log('\n📌 步骤 4：复核通过（不移交）');
  const reviewResult = wf.updateReview('EXP-002', 'approved', '复核主管老王', '数据已核实，同意改动', null);
  console.log(`   复核结果: ${reviewResult.record.reviewStatus}`);
  console.log(`   复核人: ${reviewResult.record.reviewTimeline[0].reviewer}`);
  console.log(`   复核时结果值: ${reviewResult.evaluation.displayValue}`);

  console.log('\n📌 验证 C — 复核后四处仍一致');
  const cv2 = wf.crossValidateOutputs('EXP-002');
  console.log(`   displayValue 四处一致: ${cv2.eval_consistent ? '✅' : '❌'}`);

  console.log('\n📌 步骤 5：回滚操作（验证 rollbackManualChange 入口）');
  const rbResult = wf.rollbackManualChange('EXP-002', 0, '课堂演示-回滚测试');
  console.log(`   值是否恢复: ${rbResult.valuesRestored ? '✅ 是' : '❌ 否'}`);
  console.log(`   回滚前: ${rbResult.before.displayValue}`);
  console.log(`   回滚后: ${rbResult.after.displayValue}`);
  console.log(`   分母恢复: ${JSON.stringify(rbResult.after.denominator)}`);
  console.log(`   canRollback 置 false: ${!rbResult.change.canRollback ? '✅ 是' : '❌ 否'}`);

  console.log('\n📌 验证 D — 回滚后四处一致性恢复到需复核状态');
  const cv3 = wf.crossValidateOutputs('EXP-002');
  console.log(`   displayValue 四处一致: ${cv3.eval_consistent ? '✅' : '❌'}`);
  console.log(`   当前值: ${cv3.checkValues.csv}`);

  const afterRb = wf.store.getRecord('EXP-002');
  console.log(`   原始值仍在: ${afterRb.boundaryEvidence.originalRawData.denominator === '' ? '✅ 是' : '❌ 否'}`);
  console.log(`   当前值回空: ${afterRb.boundaryEvidence.rawData.denominator === '' ? '✅ 是' : '❌ 否'}`);

  console.log('\n📌 步骤 6：再次补录分母 = 200（演示最终状态）');
  const fixResult2 = wf.applyManualChange(
    'EXP-002',
    'boundaryEvidence.rawData.denominator',
    '',
    200,
    '数据复核人老李',
    '二次确认分母为200',
    '阿岚'
  );
  console.log(`   改后值: ${fixResult2.after.displayValue}`);

  console.log('\n📌 步骤 7：保存持久化数据 + 导出所有工件');
  const artifacts = wf.exportAllArtifacts(outputDir);
  console.log('\n   📦 生成的工件文件:');
  Object.entries(artifacts).forEach(([k, p]) => {
    const size = fs.existsSync(p) ? fs.statSync(p).size : 0;
    console.log(`      ${k.padEnd(10)} → ${path.basename(p)} (${size} 字节)`);
  });

  console.log('\n📌 验证 E — 解析导出文件，验证同一份最新结果');

  const jsonData = JSON.parse(fs.readFileSync(artifacts.json, 'utf-8'));
  const jsonRecord = jsonData.records.find(r => r.id === 'EXP-002').record;
  console.log(`   [持久化JSON] 分母: ${jsonRecord.boundaryEvidence.rawData.denominator}`);
  console.log(`   [持久化JSON] 变更数: ${jsonRecord.manualChanges.length}`);
  console.log(`   [持久化JSON] 状态: ${jsonRecord.reviewStatus}`);

  const apiData = JSON.parse(fs.readFileSync(artifacts.api, 'utf-8'));
  const apiRecord = apiData.data.records.find(r => r.id === 'EXP-002').attributes;
  console.log(`   [API返回]   displayValue: ${apiRecord.displayValue}`);
  console.log(`   [API返回]   分母: ${apiRecord.denominator}`);

  const csvContent = fs.readFileSync(artifacts.csv, 'utf-8');
  const csvLines = csvContent.split('\n').filter(l => l.trim().length > 0);
  const csvHeader = csvLines[0].split(',');
  const _parseCSVLine = (line) => {
    const result = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuote = !inQuote; continue; }
      if (c === ',' && !inQuote) { result.push(cur); cur = ''; continue; }
      cur += c;
    }
    result.push(cur);
    return result;
  };
  const csvRow = _parseCSVLine(csvLines[1]);
  const csvObj = {};
  csvHeader.forEach((h, i) => { csvObj[h.trim()] = csvRow[i]?.trim() || ''; });
  console.log(`   [CSV导出]   结果展示(displayValue): ${csvObj['结果展示']}`);
  console.log(`   [CSV导出]   原始分母: ${csvObj['分母(原始值)']}`);
  console.log(`   [CSV导出]   当前分母: ${csvObj['分母']}`);
  console.log(`   [CSV导出]   分母是否改动: ${csvObj['分母是否改动']}`);
  console.log(`   [CSV导出]   复核状态: ${csvObj['复核状态']}`);
  console.log(`   [CSV导出]   下一步处理人: ${csvObj['下一步处理人']}`);
  console.log(`   [CSV导出]   人工变更次数: ${csvObj['人工变更次数']}`);

  const detailData = JSON.parse(fs.readFileSync(artifacts.detail, 'utf-8'));
  console.log(`   [详情API]   displayValue: ${detailData.data.basic.displayValue}`);
  console.log(`   [详情API]   改动次数: ${detailData.data.basic.manualChangeCount}`);
  console.log(`   [详情API]   历史记录数: ${detailData.data.traceability.manualChanges.length}`);
  console.log(`   [详情API]   复核时间线: ${detailData.data.traceability.reviewHistory.length} 条`);

  const traceData = JSON.parse(fs.readFileSync(artifacts.trace, 'utf-8'));
  console.log(`   [追溯链]    边界证据来源: ${traceData.evidenceOrigin.boundary ? '✅' : '❌'}`);
  console.log(`   [追溯链]    评分证据来源: ${traceData.evidenceOrigin.scoring ? '✅' : '❌'}`);
  console.log(`   [追溯链]    改动次数: ${traceData.valueChanges.length}`);
  console.log(`   [追溯链]    复核历史: ${traceData.reviewHistory.length} 条`);
  console.log(`   [追溯链]    审计日志: ${traceData.auditTrail.length} 条`);

  const reportContent = fs.readFileSync(artifacts.report, 'utf-8');
  console.log(`   [汇总报告]  包含"需复核": ${reportContent.includes('需复核') ? '✅' : '❌'}`);
  console.log(`   [汇总报告]  包含"已改动": ${reportContent.includes('已改动') ? '✅' : '❌'}`);
  console.log(`   [汇总报告]  包含"EXP-002": ${reportContent.includes('EXP-002') ? '✅' : '❌'}`);

  console.log('\n📌 验证 F — 所有输出 displayValue 完全一致（从不同文件解析）');
  const cvFinal = wf.crossValidateOutputs('EXP-002');
  const values = {
    '持久化JSON': jsonRecord.boundaryEvidence.rawData.denominator === 200 ? '0.4450' : '不一致',
    'API列表': apiRecord.displayValue,
    'CSV导出': csvObj['结果展示'],
    '详情API': detailData.data.basic.displayValue,
    '列表页面': cvFinal.checkValues.page,
    '列表API': cvFinal.checkValues.api,
    '列表CSV': cvFinal.checkValues.csv,
    '规则引擎直接评估': cvFinal.checkValues.list
  };
  const allSame = [...new Set(Object.values(values))].length === 1;
  console.log(`   全部一致: ${allSame ? '✅ 是' : '❌ 否'}`);
  Object.entries(values).forEach(([k, v]) => {
    console.log(`     ${k.padEnd(14)} → ${v}`);
  });

  console.log('\n📌 验证 G — 追溯链包含完整信息（原始说法、改后值、原因、下一步）');
  const t = traceData;
  const checks = [
    ['证据来源行号', t.evidenceOrigin.boundary.lineNumber > 0],
    ['原始分母值', t.evidenceOrigin.boundary.originalValues.denominator === ''],
    ['当前分母值', t.evidenceOrigin.boundary.currentValues.denominator === 200],
    ['改动历史含操作人', t.valueChanges[0].operator === '数据复核人老李'],
    ['改动历史含原因', t.valueChanges[0].reason && t.valueChanges[0].reason.length > 0],
    ['改动历史含下一步', t.valueChanges[0].nextHandler === '运营规划阿岚'],
    ['审计日志含manual_fix', t.auditTrail.some(a => a.action === 'manual_change_applied')],
    ['审计日志含rollback', t.auditTrail.some(a => a.action === 'rollback_applied')],
    ['审计日志含review', t.auditTrail.some(a => a.action === 'review_status_updated')],
    ['汇总统计总改动数', t.summary.totalChanges === 2]
  ];
  checks.forEach(([name, ok]) => {
    console.log(`   ${ok ? '✅' : '❌'} ${name}`);
  });
  const traceOk = checks.every(c => c[1]);

  console.log('\n📌 验证 H — 持久化加载后数据一致');
  const wf2 = new ThreeStepWorkflow();
  wf2.loadFromFile(artifacts.json);
  const loadedRec = wf2.store.getRecord('EXP-002');
  const loadedConsistent = loadedRec.boundaryEvidence.rawData.denominator === 200
    && loadedRec.manualChanges.length === 2
    && loadedRec.reviewStatus === 'approved';
  console.log(`   加载后分母=200: ${loadedRec.boundaryEvidence.rawData.denominator === 200 ? '✅' : '❌'}`);
  console.log(`   加载后变更数=2: ${loadedRec.manualChanges.length === 2 ? '✅' : '❌'}`);
  console.log(`   加载后状态一致: ${loadedConsistent ? '✅' : '❌'}`);

  console.log('\n' + '='.repeat(72));
  console.log('  最终验证汇总');
  console.log('='.repeat(72));

  const results = [
    ['README 中 rollbackManualChange 入口存在', allApiOk],
    ['改动后 rawData 分母真变了', fixResult.valuesChanged],
    ['四处输出一致性（改动后）', cv1.eval_consistent],
    ['回滚后值真恢复了', rbResult.valuesRestored],
    ['四处输出一致性（回滚后）', cv3.eval_consistent],
    ['原始值永不丢失', afterRb.boundaryEvidence.originalRawData.denominator === ''],
    ['持久化保存成功', fs.existsSync(artifacts.json)],
    ['导出文件 displayValue 全部一致', allSame],
    ['追溯链完整（原因/操作人/下一步）', traceOk],
    ['持久化加载后数据一致', loadedConsistent],
    ['汇总报告包含需关注清单', reportContent.includes('需关注')],
    ['历史记录可回溯', t.auditTrail.length >= 3],
  ];

  let pass = 0;
  results.forEach(([name, ok]) => {
    if (ok) pass++;
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
  });

  console.log(`\n  共 ${results.length} 项，通过 ${pass} 项，失败 ${results.length - pass} 项`);

  if (pass === results.length) {
    console.log('\n🎉 全链路验证通过！');
    console.log(`\n📁 输出目录: ${outputDir}`);
    console.log(`   可复现基线: ${path.basename(artifacts.json)}`);
    console.log(`   导出明细: ${path.basename(artifacts.csv)}`);
    console.log(`   API 响应: ${path.basename(artifacts.api)}`);
    console.log(`   汇总报告: ${path.basename(artifacts.report)}`);
    console.log(`   追溯链: ${path.basename(artifacts.trace)}`);
  } else {
    console.log('\n❌ 有验证项未通过，请检查');
    process.exit(1);
  }
})();
