import { pointService } from '../src/services/pointService';
import { feedbackService } from '../src/services/feedbackService';
import { planService } from '../src/services/planService';
import { reportService } from '../src/services/reportService';
import { generateReportCSV } from '../src/utils/export';

interface TestResult {
  name: string;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  message?: string;
}

const results: TestResult[] = [];
let step = 0;

function logStep(title: string, detail?: string) {
  step++;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`步骤 ${step}: ${title}`);
  if (detail) console.log(detail);
  console.log(`${'='.repeat(80)}`);
}

function assert(name: string, condition: boolean, actual?: unknown, expected?: unknown, message?: string): boolean {
  const passed = condition;
  results.push({ name, passed, actual, expected, message });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}`);
  if (!passed) {
    if (message) console.log(`   说明: ${message}`);
    if (actual !== undefined) console.log(`   实际: ${JSON.stringify(actual, null, 2)}`);
    if (expected !== undefined) console.log(`   期望: ${JSON.stringify(expected, null, 2)}`);
  }
  return passed;
}

function summary() {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`测试总结: ${passed}/${total} 通过`);
  console.log(`${'='.repeat(80)}`);
  if (passed < total) {
    console.log('\n失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      if (r.message) console.log(`     ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
  }
}

async function main() {
  console.log('\n' + '█'.repeat(80));
  console.log('█  道路施工绕行评估 - 集成测试脚本');
  console.log('█  测试范围: 点位归并 → 冲突处理 → 补录反馈 → 报告生成 → CSV导出');
  console.log('█'.repeat(80));

  logStep(
    '初始化数据',
    '加载 mock 数据：10个点位、10条反馈、4个方案'
  );

  const initialPoints = await pointService.getPoints();
  const initialFeedbacks = await feedbackService.getFeedbacks();
  const initialPlans = await planService.getPlans();

  assert('初始点位数量正确', initialPoints.length === 10, initialPoints.length, 10);
  assert('初始反馈数量正确', initialFeedbacks.length === 10, initialFeedbacks.length, 10);
  assert('初始方案数量正确', initialPlans.length === 4, initialPlans.length, 4);

  logStep(
    '验证人民路样例初始业务关系',
    'p001 承载人民路的所有业务数据，别名点位为空壳'
  );

  const p001 = initialPoints.find(p => p.id === 'p001')!;
  const p001a1 = initialPoints.find(p => p.id === 'p001-alias1')!;
  const p001a2 = initialPoints.find(p => p.id === 'p001-alias2')!;

  assert('p001 存在且已标记归并', !!p001 && p001.isMerged === true, p001?.isMerged, true);
  assert('p001-alias1 存在且未归并', !!p001a1 && p001a1.isMerged === false, p001a1?.isMerged, false);
  assert('p001-alias2 存在且未归并', !!p001a2 && p001a2.isMerged === false, p001a2?.isMerged, false);

  const p001Feedbacks = initialFeedbacks.filter(f => f.pointId === 'p001');
  const p001a1Feedbacks = initialFeedbacks.filter(f => f.pointId === 'p001-alias1');
  const p001a2Feedbacks = initialFeedbacks.filter(f => f.pointId === 'p001-alias2');

  assert('p001 承载 4 条反馈（f001,f002,f003,f010）', p001Feedbacks.length === 4, p001Feedbacks.length, 4);
  assert('p001-alias1 没有反馈（空壳）', p001a1Feedbacks.length === 0, p001a1Feedbacks.length, 0);
  assert('p001-alias2 没有反馈（空壳）', p001a2Feedbacks.length === 0, p001a2Feedbacks.length, 0);

  const p001Plans = initialPlans.filter(p => p.pointIds.includes('p001'));
  const p001a1Plans = initialPlans.filter(p => p.pointIds.includes('p001-alias1'));
  const p001a2Plans = initialPlans.filter(p => p.pointIds.includes('p001-alias2'));

  assert('p001 承载 2 个方案（plan001-v1, plan001-v2）', p001Plans.length === 2, p001Plans.length, 2);
  assert('p001-alias1 没有方案（空壳）', p001a1Plans.length === 0, p001a1Plans.length, 0);
  assert('p001-alias2 没有方案（空壳）', p001a2Plans.length === 0, p001a2Plans.length, 0);

  assert('p001 状态为 completed', p001.status === 'completed', p001.status, 'completed');
  assert('p001 涉及时段包含 morning/daytime/evening',
    p001.timePeriods.includes('morning') && p001.timePeriods.includes('daytime') && p001.timePeriods.includes('evening'),
    p001.timePeriods,
    ['morning', 'daytime', 'evening']
  );

  logStep(
    '获取归并候选',
    '验证系统自动识别同名路口组并包含主点位 p001'
  );

  const candidates = await pointService.getMergeCandidates();
  console.log(`找到 ${candidates.length} 个候选组`);
  candidates.forEach((g, i) => {
    console.log(`  组 ${i + 1}: ${g.map(p => `${p.id}(${p.name})`).join(', ')}`);
  });

  const renminGroup = candidates.find(g => g.some(p => p.id === 'p001-alias1'));
  assert('找到人民路候选组', !!renminGroup, !!renminGroup, true);
  assert('候选组包含 3 个点位（p001 + 2个别名）', renminGroup!.length === 3, renminGroup!.length, 3);
  assert('候选组自动包含主点位 p001', renminGroup!.some(p => p.id === 'p001'), renminGroup!.map(p => p.id), ['p001', 'p001-alias1', 'p001-alias2']);
  assert('候选组包含 p001-alias1', renminGroup!.some(p => p.id === 'p001-alias1'), true);
  assert('候选组包含 p001-alias2', renminGroup!.some(p => p.id === 'p001-alias2'), true);

  logStep(
    '执行点位归并',
    '用户选择 p001-alias1 和 p001-alias2，系统自动包含 p001 一起归并'
  );

  const userSelectedIds = ['p001-alias1', 'p001-alias2'];
  console.log(`用户选择归并: ${userSelectedIds.join(', ')}`);

  const mergedPoint = await pointService.mergePoints(userSelectedIds, '人民路与建设路交叉口（归并）');
  console.log(`归并结果: ${mergedPoint.id} - ${mergedPoint.name}`);
  console.log(`  状态: ${mergedPoint.status}`);
  console.log(`  合并来源: ${mergedPoint.mergedFrom?.join(', ')}`);
  console.log(`  涉及时段: ${mergedPoint.timePeriods.join(', ')}`);

  assert('新点位 ID 以 merged- 开头', mergedPoint.id.startsWith('merged-'), mergedPoint.id, 'merged-*');
  assert('新点位名称正确', mergedPoint.name === '人民路与建设路交叉口（归并）', mergedPoint.name);
  assert('新点位继承最优状态 completed', mergedPoint.status === 'completed', mergedPoint.status, 'completed');
  assert('新点位标记为已归并', mergedPoint.isMerged === true, mergedPoint.isMerged, true);
  assert('mergedFrom 包含所有 3 个原点位',
    mergedPoint.mergedFrom?.includes('p001') &&
    mergedPoint.mergedFrom?.includes('p001-alias1') &&
    mergedPoint.mergedFrom?.includes('p001-alias2'),
    mergedPoint.mergedFrom,
    ['p001', 'p001-alias1', 'p001-alias2']
  );
  assert('新点位继承所有时段',
    mergedPoint.timePeriods.includes('morning') &&
    mergedPoint.timePeriods.includes('daytime') &&
    mergedPoint.timePeriods.includes('evening'),
    mergedPoint.timePeriods,
    ['morning', 'daytime', 'evening']
  );

  logStep(
    '验证旧点位已移除，新点位已加入',
    '刷新数据后检查一致性'
  );

  const pointsAfterMerge = await pointService.getPoints();
  const oldPointsExist = pointsAfterMerge.some(p =>
    p.id === 'p001' || p.id === 'p001-alias1' || p.id === 'p001-alias2'
  );
  const newPointExists = pointsAfterMerge.some(p => p.id === mergedPoint.id);

  assert('3 个旧点位已移除', !oldPointsExist, oldPointsExist, false);
  assert('新点位已加入点位列表', newPointExists, newPointExists, true);
  assert('点位总数正确（10 - 3 + 1 = 8）', pointsAfterMerge.length === 8, pointsAfterMerge.length, 8);

  logStep(
    '验证反馈已全部关联到新点位',
    'p001 的 4 条反馈应全部重指向新点位'
  );

  const feedbacksAfterMerge = await feedbackService.getFeedbacks();
  const newPointFeedbacks = feedbacksAfterMerge.filter(f => f.pointId === mergedPoint.id);
  const oldPointFeedbacks = feedbacksAfterMerge.filter(f =>
    f.pointId === 'p001' || f.pointId === 'p001-alias1' || f.pointId === 'p001-alias2'
  );

  assert('旧点位没有残留反馈', oldPointFeedbacks.length === 0, oldPointFeedbacks.length, 0);
  assert('新点位关联 4 条反馈', newPointFeedbacks.length === 4, newPointFeedbacks.length, 4);

  const feedbackTitles = newPointFeedbacks.map(f => f.title).sort();
  assert('反馈内容正确：早高峰堵车严重', feedbackTitles.includes('早高峰堵车严重'), feedbackTitles, '包含早高峰堵车严重');
  assert('反馈内容正确：早高峰堵车问题', feedbackTitles.includes('早高峰堵车问题'), feedbackTitles, '包含早高峰堵车问题');
  assert('反馈内容正确：晚高峰通行方案讨论', feedbackTitles.includes('晚高峰通行方案讨论'), feedbackTitles, '包含晚高峰通行方案讨论');

  const resolvedCount = newPointFeedbacks.filter(f => f.status === 'resolved').length;
  assert('4 条反馈状态均为 resolved', resolvedCount === 4, resolvedCount, 4);

  logStep(
    '验证方案已全部关联到新点位',
    'p001 的 2 个方案应全部重指向新点位'
  );

  const plansAfterMerge = await planService.getPlans();
  const newPointPlans = plansAfterMerge.filter(p => p.pointIds.includes(mergedPoint.id));
  const oldPointPlans = plansAfterMerge.filter(p =>
    p.pointIds.includes('p001') || p.pointIds.includes('p001-alias1') || p.pointIds.includes('p001-alias2')
  );

  assert('旧点位没有残留方案', oldPointPlans.length === 0, oldPointPlans.length, 0);
  assert('新点位关联 2 个方案', newPointPlans.length === 2, newPointPlans.length, 2);

  const planVersions = newPointPlans.map(p => p.version).sort();
  assert('方案包含 v1 和 v2 版本', planVersions[0] === 'v1' && planVersions[1] === 'v2', planVersions, ['v1', 'v2']);
  assert('v2 方案为激活状态', newPointPlans.find(p => p.version === 'v2')?.isActive === true,
    newPointPlans.find(p => p.version === 'v2')?.isActive, true);
  assert('方案包含周姐提醒的业务建议',
    newPointPlans.some(p => p.suggestions.some(s => s.content.includes('周姐提醒'))),
    true);

  logStep(
    '处理关联冲突',
    '处理 p002 的 f004/f005 冲突对，验证双向闭合'
  );

  const p002FeedbacksBefore = feedbacksAfterMerge.filter(f => f.pointId === 'p002');
  const f004 = p002FeedbacksBefore.find(f => f.id === 'f004')!;
  const f005 = p002FeedbacksBefore.find(f => f.id === 'f005')!;

  assert('f004 有冲突标记', f004.hasConflict === true, f004.hasConflict, true);
  assert('f005 有冲突标记', f005.hasConflict === true, f005.hasConflict, true);
  assert('f004 冲突指向 f005', f004.conflictWith === 'f005', f004.conflictWith, 'f005');
  assert('f005 冲突指向 f004', f005.conflictWith === 'f004', f005.conflictWith, 'f004');
  assert('f005 有空值 reporter', f005.hasEmptyValue === true && f005.emptyFields?.includes('reporter'),
    f005.emptyFields, ['reporter']);
  assert('f004 状态 pending', f004.status === 'pending', f004.status, 'pending');
  assert('f005 状态 pending', f005.status === 'pending', f005.status, 'pending');

  console.log('处理冲突：采信会议纪要内容');
  await feedbackService.resolveConflict('f004', 'accept_meeting', '');

  const feedbacksAfterConflict = await feedbackService.getFeedbacks();
  const f004After = feedbacksAfterConflict.find(f => f.id === 'f004')!;
  const f005After = feedbacksAfterConflict.find(f => f.id === 'f005')!;

  assert('f004 冲突标记已清除', f004After.hasConflict === false, f004After.hasConflict, false);
  assert('f005 冲突标记已清除（双向闭合）', f005After.hasConflict === false, f005After.hasConflict, false);
  assert('f004 conflictWith 已清除', !f004After.conflictWith, f004After.conflictWith, undefined);
  assert('f005 conflictWith 已清除', !f005After.conflictWith, f005After.conflictWith, undefined);
  assert('f004 状态变为 resolved', f004After.status === 'resolved', f004After.status, 'resolved');
  assert('f005 状态变为 resolved（双向闭合）', f005After.status === 'resolved', f005After.status, 'resolved');

  logStep(
    '补录反馈空值',
    '补全 f005 的 reporter 字段，验证状态更新'
  );

  console.log('补全 f005 的 reporter 为「市政数据李工」');
  await feedbackService.updateFeedback('f005', { reporter: '市政数据李工' });

  const feedbacksAfterUpdate = await feedbackService.getFeedbacks();
  const f005AfterUpdate = feedbacksAfterUpdate.find(f => f.id === 'f005')!;

  assert('f005 reporter 已补全', f005AfterUpdate.reporter === '市政数据李工', f005AfterUpdate.reporter, '市政数据李工');
  assert('f005 空值标记已清除', f005AfterUpdate.hasEmptyValue === false, f005AfterUpdate.hasEmptyValue, false);
  assert('f005 emptyFields 已清除', !f005AfterUpdate.emptyFields, f005AfterUpdate.emptyFields, undefined);

  logStep(
    '刷新回读验证一致性',
    '重新获取所有数据，验证状态保持一致'
  );

  const pointsAfterAll = await pointService.getPoints();
  const feedbacksAfterAll = await feedbackService.getFeedbacks();
  const plansAfterAll = await planService.getPlans();

  const newPointAfterRefresh = pointsAfterAll.find(p => p.id === mergedPoint.id)!;
  const newPointFeedbacksAfterRefresh = feedbacksAfterAll.filter(f => f.pointId === mergedPoint.id);
  const newPointPlansAfterRefresh = plansAfterAll.filter(p => p.pointIds.includes(mergedPoint.id));

  assert('刷新后新点位仍存在', !!newPointAfterRefresh, !!newPointAfterRefresh, true);
  assert('刷新后反馈数量一致', newPointFeedbacksAfterRefresh.length === 4, newPointFeedbacksAfterRefresh.length, 4);
  assert('刷新后方案数量一致', newPointPlansAfterRefresh.length === 2, newPointPlansAfterRefresh.length, 2);
  assert('刷新后状态仍为 completed', newPointAfterRefresh.status === 'completed', newPointAfterRefresh.status, 'completed');

  const f004Refresh = feedbacksAfterAll.find(f => f.id === 'f004')!;
  const f005Refresh = feedbacksAfterAll.find(f => f.id === 'f005')!;
  assert('刷新后 f004 仍无冲突', f004Refresh.hasConflict === false, f004Refresh.hasConflict, false);
  assert('刷新后 f005 仍无冲突', f005Refresh.hasConflict === false, f005Refresh.hasConflict, false);
  assert('刷新后 f005 reporter 仍存在', f005Refresh.reporter === '市政数据李工', f005Refresh.reporter, '市政数据李工');

  logStep(
    '生成报告验证统计',
    '基于处理后的数据生成报告，验证统计数据正确'
  );

  const reportInput = {
    points: pointsAfterAll,
    feedbacks: feedbacksAfterAll,
    plans: plansAfterAll,
  };
  const report = await reportService.generateReport(reportInput);

  console.log(`报告 ID: ${report.id}`);
  console.log(`统计: ${JSON.stringify(report.statistics, null, 2)}`);

  assert('报告点位总数正确（8）', report.statistics.totalPoints === 8, report.statistics.totalPoints, 8);
  assert('报告反馈总数正确（10）', report.statistics.totalFeedbacks === 10,
    report.statistics.totalFeedbacks, 10);
  assert('报告已解决反馈正确（7，f006/f009为verify，f007为processing）',
    report.statistics.resolvedFeedbacks === 7,
    report.statistics.resolvedFeedbacks, 7);
  assert('报告冲突反馈为 0（已全部处理）', report.statistics.conflictFeedbacks === 0,
    report.statistics.conflictFeedbacks, 0);

  const completedIds = report.sections.completed.items.map(i => i.id);
  assert('已处理分类包含新归并点位', completedIds.includes(mergedPoint.id), completedIds, `包含 ${mergedPoint.id}`);

  const completedItem = report.sections.completed.items.find(i => i.id === mergedPoint.id)!;
  assert('报告中新点位的最新反馈不是「暂无反馈」',
    completedItem.latestFeedback !== '暂无反馈',
    completedItem.latestFeedback,
    '≠ 暂无反馈'
  );
  assert('报告中新点位的最新方案不是「暂无方案」',
    completedItem.latestPlan !== '暂无方案',
    completedItem.latestPlan,
    '≠ 暂无方案'
  );
  assert('最新反馈包含「晚高峰通行方案」',
    completedItem.latestFeedback.includes('晚高峰通行方案'),
    completedItem.latestFeedback,
    '包含晚高峰通行方案'
  );
  assert('最新方案包含「绕行方案v2」',
    completedItem.latestPlan.includes('绕行方案') && completedItem.latestPlan.includes('v2'),
    completedItem.latestPlan,
    '包含绕行方案v2'
  );

  logStep(
    '导出 CSV 验证内容',
    '导出三分类报告，验证行数和内容正确'
  );

  const csvContent = generateReportCSV(report);
  const csvLines = csvContent.split('\n').filter(l => l.trim().length > 0);
  console.log(`CSV 共 ${csvLines.length} 行`);
  console.log('前 5 行预览:');
  csvLines.slice(0, 5).forEach((l, i) => console.log(`  ${i + 1}: ${l.substring(0, 100)}`));

  const headerLine = csvLines[0];
  assert('CSV 包含表头', headerLine.includes('点位名称') && headerLine.includes('最新反馈'),
    headerLine, '包含点位名称、最新反馈');

  assert('CSV 包含分类标题行',
    csvLines.some(l => l.includes('已处理点位')) &&
    csvLines.some(l => l.includes('待核实点位')) &&
    csvLines.some(l => l.includes('需要现场复看点位')),
    true
  );

  const newPointInCSV = csvLines.some(l =>
    l.includes('人民路与建设路交叉口（归并）') &&
    l.includes('晚高峰通行方案') &&
    l.includes('已生效')
  );
  assert('CSV 包含新归并点位及其反馈和方案', newPointInCSV, newPointInCSV, true);

  const newPointLine = csvLines.find(l => l.includes('人民路与建设路交叉口（归并）'));
  assert('新归并点位在 CSV 中不含「暂无反馈」',
    !newPointLine?.includes('暂无反馈'),
    newPointLine?.includes('暂无反馈'), false);
  assert('新归并点位在 CSV 中不含「暂无方案」',
    !newPointLine?.includes('暂无方案'),
    newPointLine?.includes('暂无方案'), false);

  logStep(
    '跨时段统计验证',
    '验证归并后的数据在跨时段统计中正确聚合'
  );

  const crossPeriodData = await reportService.getCrossPeriodStats(reportInput);
  console.log('跨时段统计:');
  crossPeriodData.forEach(d => {
    console.log(`  ${d.periodLabel}: 点位 ${d.pointCount}, 反馈 ${d.feedbackCount}, 完成率 ${d.completedRate}%`);
  });

  const morningData = crossPeriodData.find(d => d.period === 'morning');
  const eveningData = crossPeriodData.find(d => d.period === 'evening');

  assert('早高峰点位包含新归并点位（>0）', morningData!.pointCount > 0, morningData?.pointCount, '>0');
  assert('早高峰反馈包含 3 条早高峰投诉 + 其他', morningData!.feedbackCount >= 3, morningData?.feedbackCount, '>=3');
  assert('晚高峰点位包含新归并点位（>0）', eveningData!.pointCount > 0, eveningData?.pointCount, '>0');
  assert('晚高峰反馈包含 f010 晚高峰方案 + 其他', eveningData!.feedbackCount >= 1, eveningData?.feedbackCount, '>=1');

  logStep(
    '验证报告文本一致性',
    '报告中的统计、分类、详情应讲同一件事'
  );

  const reportCompletedCount = report.sections.completed.count;
  const reportPendingCount = report.sections.pending.count;
  const reportReviewCount = report.sections.review.count;
  const totalInSections = reportCompletedCount + reportPendingCount + reportReviewCount;

  assert('三分类点位数量之和等于总点位',
    totalInSections === report.statistics.totalPoints,
    `${reportCompletedCount} + ${reportPendingCount} + ${reportReviewCount} = ${totalInSections}`,
    `= ${report.statistics.totalPoints}`
  );

  const completedItemInSection = report.sections.completed.items.find(i => i.id === mergedPoint.id)!;
  assert('分类详情中的点位名称与点位列表一致',
    completedItemInSection.pointName === newPointAfterRefresh.name,
    completedItemInSection.pointName,
    newPointAfterRefresh.name
  );
  assert('分类详情中的状态与点位列表一致',
    completedItemInSection.status === newPointAfterRefresh.status,
    completedItemInSection.status,
    newPointAfterRefresh.status
  );

  summary();
}

main().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
