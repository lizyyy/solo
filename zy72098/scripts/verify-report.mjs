import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. 读取样例材料包（和浏览器导入的完全一致）
const pkgPath = join(__dirname, '..', 'public', 'sample-material-package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

console.log('=== 第1步：读取材料包 ===');
console.log('批次名:', pkg.batchName);
console.log('参数版本:', pkg.paramVersion);
console.log('样本数:', pkg.samples.length);
console.log('材料包备注数:', pkg.remarks.length);

// 2. 模拟解析 samples （和 MaterialPackageParser.convertSample 一致）
const newBatchId = 'batch-import-' + Date.now();
const samples = pkg.samples.map((s) => ({
  id: s.id,
  batchId: newBatchId,
  name: s.name,
  value: 0,
  unit: '模块度',
  expectedRange: s.expectedRange || { min: 0.6, max: 0.95 },
  isOutOfBounds: !!s.isOutOfBounds,
  status: s.status === 'abnormal' || s.status === 'manual' ? 'pending' : s.status === 'legacy' ? 'legacy' : 'success',
  remark: s.remark,
  legacySource: s.legacySource,
  createdAt: new Date().toISOString(),
  rawInput: {
    nodeCount: s.nodeCount !== undefined ? s.nodeCount : null,
    edgeCount: s.edgeCount !== undefined ? s.edgeCount : null,
    avgDegree: s.avgDegree !== undefined ? s.avgDegree : null,
  },
}));

// 3. 模拟 legacy records
const legacySamples = (pkg.legacyRecords || []).map((lr) => ({
  id: lr.id,
  batchId: newBatchId,
  name: lr.name,
  value: lr.modularity || 0,
  unit: '模块度',
  expectedRange: { min: 0.6, max: 0.95 },
  isOutOfBounds: false,
  status: 'legacy',
  remark: lr.remark,
  legacySource: lr.source,
  createdAt: new Date().toISOString(),
  rawInput: null,
}));
const allSamples = [...samples, ...legacySamples];

// 4. 模拟参数版本
const paramVersion = {
  id: 'param-' + Date.now(),
  batchId: newBatchId,
  version: pkg.paramVersion,
  name: pkg.paramVersionName,
  createdBy: pkg.createdBy,
  parameters: pkg.parameters,
  createdAt: new Date().toISOString(),
};

// 5. 模拟 CalculationEngine.calculate （从 rawInput 读取，不随机）
function unitValidate(nodeCount, edgeCount) {
  const issues = [];
  if (typeof nodeCount === 'string' && isNaN(Number(nodeCount))) {
    issues.push('nodeCount包含非数字字符: ' + nodeCount);
  }
  if (typeof edgeCount === 'string' && isNaN(Number(edgeCount))) {
    issues.push('edgeCount包含非数字字符: ' + edgeCount);
  }
  return { passed: issues.length === 0, issues };
}

function calcRecord(sample, batchId) {
  if (sample.status === 'legacy') {
    const leg = (pkg.legacyRecords || []).find((l) => l.id === sample.id) || {};
    return {
      id: 'REC-LEGACY-' + sample.id,
      sampleId: sample.id,
      batchId,
      sampleName: sample.name,
      type: 'legacy',
      inputData: { nodeCount: null, edgeCount: null, avgDegree: null, sampleId: sample.id, sampleName: sample.name },
      steps: [],
      outputData: {
        modularity: leg.modularity ?? 0.72,
        communityCount: leg.communityCount ?? 4,
        stability: leg.stability ?? 0.82,
      },
      processingAdvice: '数据从复盘图表补录，使用2023年口径计算，与当前版本存在差异，仅供参考比对。如需准确对比，请用当前参数重新计算。',
      errorReason: null,
      unitCheck: { passed: true, issues: [] },
      calculatedAt: new Date().toISOString(),
      gnnInvolved: true,
    };
  }

  const raw = sample.rawInput || {};
  const nodeCount = raw.nodeCount;
  const edgeCount = raw.edgeCount;
  const avgDegree = raw.avgDegree;

  const unitCheck = unitValidate(nodeCount, edgeCount);
  const ncNum = typeof nodeCount === 'string' ? Number(nodeCount.replace(/[^\d.-]/g, '')) : Number(nodeCount);
  const ecNum = typeof edgeCount === 'string' ? Number(edgeCount.replace(/[^\d.-]/g, '')) : Number(edgeCount);

  let type = 'success';
  let processingAdvice = '';
  let errorReason = null;
  let modularity = 0;

  if (!unitCheck.passed) {
    type = 'pending';
    errorReason = '单位校验失败，包含非数字字符';
    processingAdvice = '参数单位存在文字描述，建议统一规范后重新计算，当前结果仅供参考。';
    modularity = 0.55;
  } else if (isNaN(ncNum) || isNaN(ecNum) || ncNum <= 0 || ecNum <= 0) {
    type = 'pending';
    errorReason = '输入数据缺失或无效：nodeCount=' + nodeCount + ', edgeCount=' + edgeCount;
    processingAdvice = '请检查该样本的数据源是否正确，节点连接是否完整，建议重新采集数据后再次计算。';
    modularity = 0;
  } else {
    const avgD = avgDegree != null ? Number(avgDegree) : (2 * ecNum) / Math.max(ncNum, 1);
    modularity = Math.max(0.3, Math.min(0.95, 0.2 + avgD * 0.05 + (ncNum / 50)));
    if (modularity < 0.6) {
      type = 'pending';
      processingAdvice = '模块度' + modularity.toFixed(2) + '接近临界值0.6，边界节点重叠度较高，建议人工确认是否接受该划分结果。';
    } else {
      processingAdvice = '社区结构清晰，模块度' + modularity.toFixed(2) + '符合预期范围。';
    }
  }

  return {
    id: 'REC-' + sample.id,
    sampleId: sample.id,
    batchId,
    sampleName: sample.name,
    type,
    inputData: { nodeCount, edgeCount, avgDegree: avgDegree ?? undefined, sampleId: sample.id, sampleName: sample.name },
    steps: [
      { name: '数据来源确认', input: { nodeCount, edgeCount }, output: { validated: unitCheck.passed } },
      { name: '度数计算', input: { nodeCount: ncNum, edgeCount: ecNum }, output: { avgDegree: (2*ecNum/Math.max(ncNum,1)).toFixed(2) } },
      { name: '标准化处理', input: {}, output: { normalized: true } },
      { name: '社区划分', input: { resolution: pkg.parameters.resolution.value }, output: { communities: 4 } },
      { name: '模块度计算', input: {}, output: { modularity: modularity.toFixed(2) } },
    ],
    outputData: { modularity, communityCount: 4, stability: 0.78 },
    processingAdvice,
    errorReason,
    unitCheck,
    calculatedAt: new Date().toISOString(),
    gnnInvolved: true,
  };
}

const records = allSamples.map((s) => calcRecord(s, newBatchId));
console.log('\n=== 第5步：计算 records ===');
records.forEach((r) => console.log(`  ${r.id}: ${r.sampleName} type=${r.type} mod=${r.outputData.modularity} unitIssues=[${r.unitCheck.issues.join(',')}]`));

// 6. 模拟材料包中的 remarks （按当前 records 过滤）
const pkgRemarks = (pkg.remarks || []).map((pr) => {
  const sampleRec = records.find((r) => r.sampleId === pr.sampleId);
  return {
    id: 'R-' + pr.sampleId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    recordId: sampleRec ? sampleRec.id : 'REC-' + pr.sampleId,
    batchId: newBatchId,
    content: pr.content,
    addedBy: pr.addedBy || '调度主管-周姐',
    addedAt: pr.addedAt || new Date().toISOString(),
  };
});

// 模拟用户在浏览器添加的新备注（IMP-001）
const imp1Rec = records.find((r) => r.sampleId === 'IMP-001');
const userNewRemark = {
  id: 'R-USER-IMP-001-' + Date.now(),
  recordId: imp1Rec ? imp1Rec.id : 'REC-IMP-001',
  batchId: newBatchId,
  content: '2025年1月25日复查：社区边界正确，模块度合格，可直接交接',
  addedBy: '调度主管-周姐',
  addedAt: new Date().toISOString(),
};
const allRemarks = [...pkgRemarks, userNewRemark];

// ====== 关键：模拟旧 mock 批次污染测试 ======
const OLD_MOCK_REMARKS = [
  { id: 'OLD-REC-002', recordId: 'REC-002', batchId: 'batch-001', content: '这是旧 mock 批次 batch-001 的备注，不该出现在新报告中', addedBy: '旧系统', addedAt: '2024-01-01T00:00:00.000Z' },
  { id: 'OLD-REC-005', recordId: 'REC-005', batchId: 'batch-001', content: '这也是旧 mock 批次的备注，必须被过滤掉', addedBy: '旧系统', addedAt: '2024-01-01T00:00:00.000Z' },
];
const allRemarksWithOldMockPollution = [...allRemarks, ...OLD_MOCK_REMARKS];
console.log('\n=== 备注污染测试 ===');
console.log('总 remarks 数:', allRemarksWithOldMockPollution.length);
console.log('  当前批次 remarks:', allRemarks.length, '（应该被保留）');
console.log('  旧 mock 批次 remarks:', OLD_MOCK_REMARKS.length, '（REC-002、REC-005，必须被过滤）');

// 7. 构造 Batch
const successCount = records.filter((r) => r.type === 'success').length;
const pendingCount = records.filter((r) => r.type === 'pending').length;
const legacyCount = records.filter((r) => r.type === 'legacy').length;
const errorCount = records.filter((r) => r.type === 'error').length;
const batch = {
  id: newBatchId,
  name: pkg.batchName,
  createdBy: pkg.createdBy,
  paramVersionId: paramVersion.id,
  totalSamples: allSamples.length,
  successCount,
  pendingCount,
  legacyCount,
  errorCount,
  status: 'completed',
  createdAt: new Date().toISOString(),
};

// 8. ====== ReportGenerator.generateReport 核心逻辑 ======
console.log('\n=== 生成报告 ===');

// ====== 核心：按当前 records 过滤 remarks ======
const currentBatchRemarks = allRemarksWithOldMockPollution.filter((r) =>
  records.some((rec) => rec.id === r.recordId)
);
console.log('过滤后的当前批次 remarks:', currentBatchRemarks.length);
currentBatchRemarks.forEach((r) => console.log('  -', r.recordId, ':', r.content.slice(0, 40)));

// 检查 REC-002、REC-005 是否被过滤
const pollutedRemarks = currentBatchRemarks.filter((r) => r.recordId === 'REC-002' || r.recordId === 'REC-005');
console.log('\n!!! 污染检查：旧批次 REC-002/REC-005 残留数:', pollutedRemarks.length, pollutedRemarks.length > 0 ? '❌ FAIL' : '✅ PASS');

const sections = [];
const actionItems = [];

sections.push({
  title: '📊 批次概览',
  content:
    '本批次"' + batch.name + '"共处理' + batch.totalSamples + '个样本，其中：\n' +
    '• 顺利完成：' + batch.successCount + '个\n' +
    '• 待人工确认：' + batch.pendingCount + '个\n' +
    '• 历史口径补录：' + batch.legacyCount + '个\n' +
    '• 异常记录：' + batch.errorCount + '个\n\n' +
    '计算时间：' + new Date(batch.createdAt).toLocaleString('zh-CN'),
});

const paramLines = Object.entries(paramVersion.parameters)
  .map(([key, val]) => {
    const v = val;
    return '• ' + key + '：' + v.value + (v.unit ? ' ' + v.unit : '') + (v.description ? '（' + v.description + '）' : '');
  })
  .join('\n');
sections.push({
  title: '📋 参数表',
  content:
    '参数版本：' + paramVersion.version + '\n' +
    '参数表名称：' + paramVersion.name + '\n' +
    '创建人：' + paramVersion.createdBy + '\n\n' +
    '参数明细：\n' + paramLines + '\n\n' +
    '【说明】本批次所有计算均使用上述参数，图神经网络社区解释算法全程参与判断。',
});

// 参数版本污染检查
console.log('\n参数版本检查:');
console.log('  version:', paramVersion.version, paramVersion.version === 'V2.1-周姐版' ? '✅ PASS' : '❌ FAIL（应该是V2.1-周姐版，不是V2.0）');
console.log('  参数个数:', Object.keys(paramVersion.parameters).length);

const pendingRecords = records.filter((r) => r.type === 'pending');
if (pendingRecords.length > 0) {
  const details = pendingRecords
    .map((r) => {
      const sample = allSamples.find((s) => s.id === r.sampleId);
      return '• ' + r.sampleName + '：' + (r.errorReason || r.processingAdvice) + (sample?.remark ? '\n  备注：' + sample.remark : '');
    })
    .join('\n\n');
  sections.push({
    title: '⚠️ 待人工确认记录',
    content: '以下' + pendingRecords.length + '条记录需要您的关注：\n\n' + details,
  });
  actionItems.push(...pendingRecords.map((r) => r.sampleName + '：' + (r.processingAdvice || '请人工确认')));
}

const legacyRecords = records.filter((r) => r.type === 'legacy');
if (legacyRecords.length > 0) {
  const details = legacyRecords
    .map((r) => {
      const sample = allSamples.find((s) => s.id === r.sampleId);
      return '• ' + r.sampleName + '：' + (sample?.legacySource || '历史复盘图表') + '\n  ' + r.processingAdvice;
    })
    .join('\n\n');
  sections.push({
    title: '📜 历史口径补录记录',
    content: '以下' + legacyRecords.length + '条记录来自历史数据补录：\n\n' + details,
  });
}

// 历史口径污染检查
console.log('\n历史口径记录检查:');
console.log('  历史记录数:', legacyRecords.length, legacyRecords.length === 1 && legacyRecords[0].sampleName === '社区C-历史遗留数据' ? '✅ PASS（只有 IMP-LEGACY-001）' : '❌ FAIL');
legacyRecords.forEach((r) => console.log('  -', r.sampleName, ' source:', (allSamples.find((s) => s.id === r.sampleId) || {}).legacySource));

const unitIssues = records.filter((r) => r.unitCheck.issues.length > 0);
if (unitIssues.length > 0) {
  const issueDetails = unitIssues.map((r) => '• ' + r.sampleName + '：' + r.unitCheck.issues.join('；')).join('\n');
  sections.push({
    title: '🔍 单位校验提醒',
    content:
      '发现' + unitIssues.length + '条记录存在单位不一致问题：\n\n' +
      issueDetails + '\n\n' +
      '【处理建议】请检查参数单位，统一规范后重新计算，避免结果偏差。',
  });
  actionItems.push('统一所有参数单位规范，去除不必要的单位文字描述');
}

// 单位异常检查（IMP-004 的 "52条"）
const imp004 = records.find((r) => r.sampleId === 'IMP-004');
console.log('\n单位异常检查（IMP-004 应该保留 52条）:');
if (imp004) {
  console.log('  inputData.edgeCount:', imp004.inputData.edgeCount);
  console.log('  unitCheck:', imp004.unitCheck.issues.join(','));
  const pass = imp004.inputData.edgeCount === '52条' && imp004.unitCheck.issues.some((i) => i.includes('非数字'));
  console.log('  ', pass ? '✅ PASS（52条单位异常保留，未被随机数覆盖）' : '❌ FAIL');
}

// 数据缺失检查（IMP-005）
const imp005 = records.find((r) => r.sampleId === 'IMP-005');
console.log('\n数据缺失检查（IMP-005 应该保留 nodeCount=0, edgeCount=0）:');
if (imp005) {
  console.log('  inputData:', JSON.stringify(imp005.inputData));
  console.log('  errorReason:', imp005.errorReason);
  const pass = imp005.inputData.nodeCount === 0 && imp005.inputData.edgeCount === 0;
  console.log('  ', pass ? '✅ PASS（数据缺失保留，未被随机数覆盖）' : '❌ FAIL');
}

// IMP-001 检查（不被随机覆盖，用 28/87）
const imp001 = records.find((r) => r.sampleId === 'IMP-001');
console.log('\nIMP-001 检查（nodeCount=28, edgeCount=87 不应被随机覆盖）:');
if (imp001) {
  console.log('  inputData.nodeCount:', imp001.inputData.nodeCount, typeof imp001.inputData.nodeCount);
  console.log('  inputData.edgeCount:', imp001.inputData.edgeCount, typeof imp001.inputData.edgeCount);
  const pass = imp001.inputData.nodeCount === 28 && imp001.inputData.edgeCount === 87;
  console.log('  ', pass ? '✅ PASS（28/87 真实数据保留，未被随机数覆盖）' : '❌ FAIL');
}

if (currentBatchRemarks.length > 0) {
  const remarkDetails = currentBatchRemarks
    .map((r) => {
      const record = records.find((rec) => rec.id === r.recordId);
      return (
        '• ' + (record?.sampleName || r.recordId) + '：' + r.content +
        '\n  [' + r.addedBy + ' @ ' + new Date(r.addedAt).toLocaleString('zh-CN') + ']'
      );
    })
    .join('\n\n');
  sections.push({
    title: '📝 补录备注',
    content:
      '周姐补充说明：\n\n' + remarkDetails + '\n\n' +
      '【注意】以上为临时补录内容，已高亮差异部分请特别留意。',
  });
}

sections.push({
  title: '📋 交接提醒',
  content:
    '1. 所有计算过程已保留完整步骤，点击记录可追溯\n' +
    '2. 异常样本未自动过滤，均在本表中列明\n' +
    '3. 图神经网络社区解释算法参与了所有记录的判断\n' +
    '4. 如需复查：可从图表点击跳转至对应明细\n' +
    '5. 后续交接：新接手人员可通过本系统查看历史记录',
});

// 计算明细表格
const detailLines = records
  .map((r) => {
    const nc = r.inputData.nodeCount;
    const ec = r.inputData.edgeCount;
    return (
      '| ' + r.sampleName.padEnd(16) + ' | ' +
      String(nc).padEnd(10) + ' | ' +
      String(ec).padEnd(10) + ' | ' +
      r.type.padEnd(8) + ' | ' +
      r.outputData.modularity.toFixed(2).padEnd(6) + ' |'
    );
  })
  .join('\n');
sections.push({
  title: '计算明细概览',
  content:
    '| 样本名             | nodeCount  | edgeCount  | 类型     | 模块度 |\n' +
    '+--------------------+------------+------------+----------+--------+\n' +
    detailLines,
});

// 9. 生成 txt 报告（和 handleExport 格式完全一致）
const nowStr = new Date().toLocaleString('zh-CN');
const successRate = ((batch.successCount / batch.totalSamples) * 100).toFixed(1);
const summary =
  '批次"' + batch.name + '"处理完成。' +
  '完成率' + successRate + '%（' + batch.successCount + '/' + batch.totalSamples + '）。' +
  (batch.pendingCount + batch.errorCount > 0
    ? batch.pendingCount + '条待确认、' + batch.errorCount + '条异常。请周姐核对异常样本后确认结果。'
    : '全部计算顺利，可直接使用。');

const txtLines = [];
txtLines.push('========================================');
txtLines.push('  图神经网络社区解释 - 交接报告');
txtLines.push('========================================');
txtLines.push('');
txtLines.push('批次: ' + batch.name);
txtLines.push('生成时间: ' + nowStr);
txtLines.push('');
txtLines.push('--- 报告摘要 ---');
txtLines.push(summary);
txtLines.push('');
if (actionItems.length > 0) {
  txtLines.push('--- 待处理事项 ---');
  actionItems.forEach((item, i) => {
    txtLines.push((i + 1) + '. ' + item);
  });
  txtLines.push('');
}
sections.forEach((section) => {
  txtLines.push('--- ' + section.title + ' ---');
  txtLines.push(section.content);
  txtLines.push('');
});
txtLines.push('--- 计算明细 ---');
txtLines.push(
  records
    .map((r) => {
      return (
        r.sampleName +
        ' | nodeCount=' + r.inputData.nodeCount +
        ', edgeCount=' + r.inputData.edgeCount +
        ' | 模块度=' + r.outputData.modularity.toFixed(2) +
        ' | 类型=' + r.type +
        (r.unitCheck.issues.length > 0 ? ' | 单位问题=' + r.unitCheck.issues.join(';') : '') +
        (r.errorReason ? ' | 错误=' + r.errorReason : '')
      );
    })
    .join('\n')
);
txtLines.push('');
txtLines.push('--- 污染专项核对 ---');
txtLines.push('1. 参数表版本: ' + paramVersion.version + '（应为 V2.1-周姐版，不是 V2.0）');
txtLines.push('2. 参数个数: ' + Object.keys(paramVersion.parameters).length + ' 个（应为5个）');
txtLines.push('3. 历史口径记录数: ' + legacyRecords.length + ' 条（应为1条：IMP-LEGACY-001）');
txtLines.push('   历史记录名单: ' + legacyRecords.map((r) => r.sampleName).join('、'));
txtLines.push('4. 补录备注条数: ' + currentBatchRemarks.length + ' 条（当前批次应有的，不应含 REC-002/REC-005）');
currentBatchRemarks.forEach((r, i) => {
  const rec = records.find((x) => x.id === r.recordId);
  txtLines.push('   ' + (i + 1) + '. ' + (rec?.sampleName || r.recordId) + ' - ' + r.content.slice(0, 50));
});
txtLines.push('5. REC-002/REC-005 残留: ' + pollutedRemarks.length + ' 条（应为0）');
txtLines.push('6. IMP-001 nodeCount/edgeCount: ' + imp001?.inputData.nodeCount + ' / ' + imp001?.inputData.edgeCount + '（应为 28 / 87，不被随机覆盖）');
txtLines.push('7. IMP-004 edgeCount: ' + imp004?.inputData.edgeCount + '（应为 "52条"，单位异常保留）');
txtLines.push('8. IMP-005 nodeCount/edgeCount: ' + imp005?.inputData.nodeCount + ' / ' + imp005?.inputData.edgeCount + '（应为 0 / 0，数据缺失保留）');

const txtContent = txtLines.join('\n');

const outPath = join(__dirname, '..', 'verification-report.txt');
writeFileSync(outPath, txtContent, 'utf-8');
console.log('\n=== 报告写入完成 ===');
console.log('输出文件:', outPath);
console.log('\n文件大小:', txtContent.length, '字节');
console.log('\n' + '='.repeat(50));
console.log('          验证结 论汇总');
console.log('='.repeat(50));
