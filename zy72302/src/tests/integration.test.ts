import { boundarySampleManager } from '../core/boundarySampleManager';
import { importManualCounterExamples, importQuestionnaireRows } from '../core/dataImporter';
import { formatBoundaryReport } from '../core/reportGenerator';
import { calculateQueueMetrics } from '../core/queueCalculator';
import { WindowConfig, ReviewResult } from '../types';
import * as path from 'path';

console.log('='.repeat(80));
console.log('排队论窗口配置系统 - 集成测试');
console.log('='.repeat(80));
console.log('');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => boolean) {
    try {
      const result = fn();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (e) {
      console.log(`❌ ${name}: ${(e as Error).message}`);
      failed++;
    }
  }

  boundarySampleManager.clear();

  console.log('【第一步：导入手算反例，检测负数样本】');
  console.log('');

  const dataDir = path.resolve(__dirname, '../../data');
  
  const manualExamples = importManualCounterExamples(path.join(dataDir, 'manualCounterExamples.json'));
  const questionnaireRows = importQuestionnaireRows(path.join(dataDir, 'questionnaireRows.json'));

  test('导入手算反例成功', () => manualExamples.length === 5);
  test('导入问卷原始行成功', () => questionnaireRows.length === 2);

  const negativeSamples = boundarySampleManager.detectNegativeSamples(manualExamples, []);
  
  test('检测到3个负数样本', () => negativeSamples.length === 3);
  test('SAMPLE-001 被旧表标记为缺失', () => 
    negativeSamples.some(n => n.sampleId === 'SAMPLE-001' && n.isMarkedAsMissing));
  test('SAMPLE-002 被旧表标记为缺失', () => 
    negativeSamples.some(n => n.sampleId === 'SAMPLE-002' && n.isMarkedAsMissing));
  test('SAMPLE-004 被旧表标记为缺失', () => 
    negativeSamples.some(n => n.sampleId === 'SAMPLE-004' && n.isMarkedAsMissing));

  for (const ns of negativeSamples) {
    const manual = manualExamples.find(m => m.sampleId === ns.sampleId);
    boundarySampleManager.createBoundarySample(ns, manual, undefined);
  }

  const boundarySamples = boundarySampleManager.getAllBoundarySamples();
  test('创建3个边界样本', () => boundarySamples.length === 3);
  test('所有边界样本初始状态为待学生助教复核', () => 
    boundarySamples.every(s => s.status === 'pending_ta'));
  test('所有边界样本含原始负数字段', () =>
    boundarySamples.every(s => 'originalNegativeValues' in s && 'reviewLog' in s));
  test('SAMPLE-001 含原始负数等待时间', () => {
    const s = boundarySamples.find(x => x.sampleId === 'SAMPLE-001');
    return !!s && s.originalNegativeValues.waitTime === -5;
  });
  test('SAMPLE-001 缺少问卷原始行', () => {
    const s = boundarySamples.find(x => x.sampleId === 'SAMPLE-001');
    return !!s?.missingMaterials.includes('缺少问卷原始行（现场说法）');
  });
  test('SAMPLE-001 包含主流程证据', () => {
    const s = boundarySamples.find(x => x.sampleId === 'SAMPLE-001');
    return !!s?.whyKept.includes('主流程关键证据');
  });

  console.log('');
  console.log('【错误场景测试：样本不存在 / 状态不允许】');
  console.log('');

  const errNotExist = boundarySampleManager.taReviewV2('NOT-EXIST', true, '');
  test('不存在样本返回错误 sample_not_found', () => 
    !errNotExist.success && errNotExist.errorKind === 'sample_not_found');
  test('错误信息含当前总样本数', () => 
    !!errNotExist.errorMessage?.includes('总样本数'));
  test('错误提供 hints', () => !!errNotExist.hints && errNotExist.hints.length > 0);

  boundarySampleManager.taReviewV2('SAMPLE-001', true, '补录前先试一次通过（无问卷）');
  const beforeCoach = boundarySampleManager.findBySampleId('SAMPLE-001');
  test('无问卷时仍处于待学生助教', () => !!beforeCoach && beforeCoach.status === 'pending_ta');

  const coachErr = boundarySampleManager.coachReviewV2('SAMPLE-001', true, '');
  test('待助教状态不允许唐老师直接复核', () =>
    !coachErr.success && coachErr.errorKind === 'invalid_status_transition');

  console.log('');
  console.log('【第二步：学生助教补录问卷原始行】');
  console.log('');

  const sample001Q = questionnaireRows.find(q => q.sampleId === 'SAMPLE-001')!;
  const sample002Q = questionnaireRows.find(q => q.sampleId === 'SAMPLE-002')!;

  const ta1: ReviewResult = boundarySampleManager.taReviewV2(
    'SAMPLE-001', true, '已核实现场说法，数据合理', sample001Q
  );

  test('学生助教成功复核 SAMPLE-001 (V2返回success=true)', () => ta1.success === true && !!ta1.sample);
  test('SAMPLE-001 补充问卷后缺失材料减少', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!(s && !s.missingMaterials.includes('缺少问卷原始行（现场说法）'));
  });
  test('SAMPLE-001 状态变为待唐老师复核', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s && s.status === 'pending_coach';
  });
  test('SAMPLE-001 负责人变为唐老师', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s && s.assignee === '竞赛教练唐老师';
  });
  test('SAMPLE-001 原始负数保留（不提前归正常）', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s && s.originalNegativeValues.waitTime === -5;
  });
  test('SAMPLE-001 复核历史至少2条（创建+ta_review）', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s && s.reviewLog.length >= 2;
  });
  test('SAMPLE-001 复核历史含补录标记', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s?.reviewLog.some(l => l.rawStatementAdded === true);
  });
  test('SAMPLE-001 whyKept 包含现场说法', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s?.whyKept.includes('现场说法记录');
  });

  const ta2: ReviewResult = boundarySampleManager.taReviewV2(
    'SAMPLE-002', true, '排队溢出情况属实，数据已修正', sample002Q
  );

  test('学生助教成功复核 SAMPLE-002', () => ta2.success === true);
  test('SAMPLE-002 涉及排队溢出，下一步找唐老师', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-002');
    return !!s && s.nextAction === 'find_coach';
  });

  console.log('');
  console.log('【第三步：唐老师最终确认，边界样本报告更新】');
  console.log('');

  const coachR1: ReviewResult = boundarySampleManager.coachReviewV2(
    'SAMPLE-001', true, '临时关窗情况确认，该样本保留用于窗口排班优化分析'
  );

  test('唐老师成功确认 SAMPLE-001 (V2)', () => coachR1.success === true);
  test('SAMPLE-001 状态变为已确认', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s && s.status === 'coach_verified';
  });
  test('SAMPLE-001 下一步可以解决', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s && s.nextAction === 'resolve';
  });
  test('SAMPLE-001 唐老师备注已保存', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s?.coachReviewNotes?.includes('临时关窗情况确认');
  });
  test('SAMPLE-001 含最终处理结果dataResolution', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s?.dataResolution?.resolved;
  });
  test('SAMPLE-001 dataResolution含最终值', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s?.dataResolution?.finalWaitTime && s.dataResolution.finalWaitTime >= 0;
  });
  test('SAMPLE-001 dataResolution含下一步找谁', () => {
    const s = boundarySampleManager.findBySampleId('SAMPLE-001');
    return !!s?.dataResolution?.nextContactPerson;
  });

  const coachR2: ReviewResult = boundarySampleManager.coachReviewV2(
    'SAMPLE-002', true, '排队溢出情况属实，建议该时段增加窗口'
  );
  test('唐老师成功确认 SAMPLE-002', () => coachR2.success === true);

  const report = boundarySampleManager.generateReport();
  test('报告生成成功', () => report !== undefined);
  test('报告统计：总样本3个', () => report.statistics.total === 3);
  test('报告统计：2个已确认', () => report.statistics.verified === 2);
  test('报告统计：1个待学生助教', () => report.statistics.pendingTa === 1);
  test('报告.boundarySamples 含完整数据', () => 
    report.boundarySamples.every(s => 'reviewLog' in s && 'originalNegativeValues' in s));

  const reportText = formatBoundaryReport(report);
  test('报告文本生成成功', () => reportText.length > 0);
  test('报告含"为什么留下"', () => reportText.includes('为什么留下'));
  test('报告含"还缺什么材料"', () => reportText.includes('还缺什么材料'));
  test('报告含"下一步"', () => reportText.includes('下一步'));
  test('报告含原始负数对比', () => reportText.includes('原始负数值 ↔ 修正后'));
  test('报告含复核历史', () => reportText.includes('复核历史'));
  test('报告含最终处理结果', () => reportText.includes('最终处理结果'));
  test('报告强调基于同一份数据', () => reportText.includes('同一份最新状态'));
  test('总样本数为0时报告有提示', () => {
    boundarySampleManager.clear();
    const empty = boundarySampleManager.generateReport();
    const txt = formatBoundaryReport(empty);
    return txt.includes('总样本数: 0') && txt.includes('import');
  });

  console.log('');
  console.log('【排队论算法测试：现场因素影响】');
  console.log('');

  // 恢复样本数据供后续算法测试前先清空再用（前面清空用于测试empty报告）
  boundarySampleManager.clear();

  const windowConfig: WindowConfig = {
    windowNumber: 1,
    startTime: '08:00',
    endTime: '18:00',
    capacity: 3,
    isActive: true,
    hasLunchBreak: true,
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
  };

  const normalTime = new Date('2024-01-15T10:00:00');
  const lunchTime = new Date('2024-01-15T12:15:00');

  const normalResult = calculateQueueMetrics('TEST-NORMAL', 1, normalTime, 15, 8, windowConfig);
  const lunchResult = calculateQueueMetrics('TEST-LUNCH', 1, lunchTime, 15, 8, windowConfig);

  test('正常时间计算成功', () => normalResult.averageWaitTime > 0);
  test('午休时间有影响因子', () => lunchResult.factors.lunchBreakImpact > 0);
  test('午休影响服务率降低', () => lunchResult.serviceRate < normalResult.serviceRate);

  const overflowQ = {
    id: 'qr_test',
    sampleId: 'TEST-OVERFLOW',
    timestamp: normalTime,
    windowNumber: 1,
    onSiteStatement: '测试排队溢出',
    witnessName: '测试',
    hasBreak: false,
    isTemporaryClosed: false,
    queueOverflow: true,
    actualWaitTime: 30,
    actualArrivalCount: 30,
  };

  const overflowResult = calculateQueueMetrics('TEST-OVERFLOW', 1, normalTime, 30, 8, windowConfig, overflowQ);
  test('排队溢出有影响因子', () => overflowResult.factors.queueOverflowImpact > 0);
  test('排队溢出标记为溢出状态', () => overflowResult.isOverflow === true);

  const closedQ = {
    ...overflowQ,
    sampleId: 'TEST-CLOSED',
    isTemporaryClosed: true,
    queueOverflow: false,
  };

  const closedResult = calculateQueueMetrics('TEST-CLOSED', 1, normalTime, 10, 8, windowConfig, closedQ);
  test('临时关窗有影响因子', () => closedResult.factors.temporaryClosureImpact > 0);
  test('临时关窗影响大于午休', () => 
    closedResult.factors.temporaryClosureImpact > lunchResult.factors.lunchBreakImpact);

  console.log('');
  console.log('='.repeat(80));
  console.log(`测试结果：${passed} 通过，${failed} 失败`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
