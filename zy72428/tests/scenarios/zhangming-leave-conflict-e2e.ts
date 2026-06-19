import { dataStore } from '../../src/store/data-store';
import { workflowService } from '../../src/services/workflow-service';
import { checklistService } from '../../src/services/checklist-service';
import { selfCheckService } from '../../src/services/self-check-service';
import { scheduleImportService } from '../../src/services/schedule-import-service';
import { AliasImportInput } from '../../src/services/alias-import-service';
import { ScheduleImportInput } from '../../src/services/schedule-import-service';
import { PhotoUploadInput } from '../../src/services/photo-review-service';
import { MaterialSource, ConflictReportEntry } from '../../src/types';

function createDate(daysOffset: number): Date {
  const date = new Date(2026, 5, 10);
  date.setDate(date.getDate() + daysOffset);
  date.setHours(0, 0, 0, 0);
  return date;
}

const LEAVE_DATE = createDate(-2);
const LEAVE_DATE_STR = LEAVE_DATE.toLocaleDateString();

const aliasesWrongCaliber: AliasImportInput[] = [
  {
    canonicalName: '茉莉花',
    aliases: ['好一朵美丽的茉莉花', '茉莉花开'],
    copyrightHolder: '中国传统民歌版权协会',
    source: 'wrong-caliber' as MaterialSource,
  },
  {
    canonicalName: '康定情歌',
    aliases: ['跑马溜溜的山上'],
    copyrightHolder: '四川民歌版权中心',
    source: 'wrong-caliber' as MaterialSource,
  },
];

const schedulesWrongCaliber: ScheduleImportInput[] = [
  {
    sessionDate: LEAVE_DATE,
    performerId: 'P001',
    performerName: '张明',
    locationId: 'L001',
    locationName: '南京路步行街',
    trackName: '茉莉花',
    isConsumed: true,
    isLeave: true,
    consumedHours: 2,
    source: 'wrong-caliber' as MaterialSource,
  },
];

const photosWrongCaliber: PhotoUploadInput[] = [
  {
    sessionDate: LEAVE_DATE,
    performerId: 'P001',
    performerName: '张明',
    locationId: 'L001',
    locationName: '南京路步行街',
    trackName: '茉莉花',
    isLeave: true,
    leaveReason: '身体不适',
    photoUrl: 'photos/P001-leave.jpg',
    source: 'wrong-caliber' as MaterialSource,
  },
];

interface AssertionResult {
  name: string;
  passed: boolean;
  actual: any;
  expected: any;
}

function assertEqual(name: string, actual: any, expected: any): AssertionResult {
  const passed = actual === expected;
  if (!passed) {
    console.error(`  ❌ ${name}: 期望="${expected}", 实际="${actual}"`);
  } else {
    console.log(`  ✅ ${name}`);
  }
  return { name, passed, actual, expected };
}

function assertIncludes(name: string, actual: string, expectedSubstring: string): AssertionResult {
  const passed = actual.includes(expectedSubstring);
  if (!passed) {
    console.error(`  ❌ ${name}: 期望包含"${expectedSubstring}", 实际="${actual}"`);
  } else {
    console.log(`  ✅ ${name}`);
  }
  return { name, passed, actual, expected: expectedSubstring };
}

function findZhangmingLeaveConflict(report: ConflictReportEntry[]): ConflictReportEntry {
  const found = report.find(
    (r) => r.performerName === '张明' && r.sessionDate.getTime() === LEAVE_DATE.getTime()
  );
  if (!found) {
    throw new Error('未找到张明的请假误算冲突记录！');
  }
  return found;
}

function runZhangmingLeaveTest(): { allPassed: boolean; results: AssertionResult[] } {
  console.log('\n' + '═'.repeat(70));
  console.log('专项测试：张明请假课时误算冲突 - 类型保留与全字段校验');
  console.log('═'.repeat(70));

  dataStore.clear();
  const allResults: AssertionResult[] = [];

  const workflow = workflowService.startWorkflow('wrong-caliber');
  workflowService.step1_ImportAliases(
    workflow.batchId,
    aliasesWrongCaliber,
    schedulesWrongCaliber
  );
  workflowService.step2_ReviewPhotos(workflow.batchId, photosWrongCaliber);
  workflowService.step3_UpdateChecklist(workflow.batchId);

  console.log('\n【阶段 1】处理前 - 冲突报告');
  let report = checklistService.getConflictReport();
  let zhangming = findZhangmingLeaveConflict(report);
  console.log(`  艺人: ${zhangming.performerName}, 日期: ${zhangming.sessionDate.toLocaleDateString()}`);
  console.log(`  冲突类型: ${zhangming.type}`);
  console.log(`  描述: ${zhangming.description}`);

  allResults.push(
    assertEqual('冲突类型应为 leave-counted-as-consumed（请假误算）', zhangming.type, 'leave-counted-as-consumed'),
    assertIncludes('描述应包含"请假课时被误算为已消耗"', zhangming.description, '请假课时被误算为已消耗'),
    assertEqual('来源应为 wrong-caliber', zhangming.source, 'wrong-caliber'),
    assertEqual('needsCoordinatorReview 应为 true', zhangming.needsCoordinatorReview, true),
    assertIncludes(
      'triggerAction 应说明"请假课时被算进已消耗"',
      zhangming.triggerAction,
      '请假课时被算进已消耗'
    ),
    assertEqual(
      '处理前 status 应为 pending',
      zhangming.status,
      'pending'
    ),
    assertIncludes(
      '处理前 currentStatus 应包含"待巡演统筹复核"',
      zhangming.currentStatus,
      '待巡演统筹复核'
    ),
    assertIncludes(
      'suggestion 应说明"请假课时不应计入已消耗"',
      zhangming.suggestion,
      '请假课时不应计入已消耗'
    )
  );

  if (zhangming.scheduleEvidence) {
    allResults.push(
      assertEqual('排班证据.isConsumed 应为 true（误算）', zhangming.scheduleEvidence.isConsumed, true),
      assertEqual('排班证据.isLeave 应为 true', zhangming.scheduleEvidence.isLeave, true),
      assertEqual('排班证据.consumedHours 应为 2', zhangming.scheduleEvidence.consumedHours, 2)
    );
  } else {
    allResults.push({ name: '排班证据存在', passed: false, actual: '无', expected: '有' });
    console.error('  ❌ 排班证据缺失');
  }

  allResults.push(
    assertEqual('照片证据.isLeave 应为 true', zhangming.photoEvidence.isLeave, true),
    assertEqual('照片证据.trackName 应为 茉莉花', zhangming.photoEvidence.trackName, '茉莉花'),
    assertIncludes(
      '历史记录应包含"生成核对项"',
      zhangming.historySummary.join('|'),
      '生成核对项'
    ),
    assertIncludes(
      '导出行.冲突类型 应为"请假课时被误算为已消耗"',
      zhangming.exportRow['冲突类型'] || '',
      '请假课时被误算为已消耗'
    ),
    assertIncludes(
      '导出行.冲突描述 应包含"请假课时被误算为已消耗"',
      zhangming.exportRow['冲突描述'] || '',
      '请假课时被误算为已消耗'
    )
  );

  console.log('\n【阶段 2】导出核对表（处理前）');
  const exportBefore = checklistService.exportChecklist('wrong-caliber');
  const zhangmingExportBefore = exportBefore.find(
    (r: any) => r['艺人'] === '张明'
  );
  if (zhangmingExportBefore) {
    console.table(zhangmingExportBefore);
    allResults.push(
      assertIncludes(
        '导出"原始冲突类型"应显示为请假误算',
        zhangmingExportBefore['原始冲突类型'],
        '请假课时被误算为已消耗'
      ),
      assertIncludes(
        '导出"原始冲突描述"不应只剩冲突编号',
        zhangmingExportBefore['原始冲突描述'],
        '请假课时被误算为已消耗'
      )
    );
  }

  console.log('\n【阶段 3】巡演统筹复核请假记录');
  const checklistItems = dataStore.getAllChecklistItems();
  const zhangmingItem = checklistItems.find(
    (i) => i.performerName === '张明' && i.sessionDate.getTime() === LEAVE_DATE.getTime()
  );
  if (!zhangmingItem) {
    throw new Error('未找到张明的核对项');
  }

  workflowService.reviewLeaveByCoordinator(
    workflow.batchId,
    zhangmingItem.id,
    '巡演统筹老王'
  );

  console.log('\n【阶段 4】复核后 - 再次取冲突报告验证类型不变');
  report = checklistService.getConflictReport();
  zhangming = findZhangmingLeaveConflict(report);
  console.log(`  艺人: ${zhangming.performerName}, 日期: ${zhangming.sessionDate.toLocaleDateString()}`);
  console.log(`  冲突类型: ${zhangming.type}`);
  console.log(`  描述: ${zhangming.description}`);
  console.log(`  当前状态: ${zhangming.currentStatus}`);
  console.log(`  处理判断: ${zhangming.processingJudgment}`);
  console.log(`  最终结论: ${zhangming.conclusion}`);

  allResults.push(
    assertEqual(
      '【关键】复核后冲突类型仍应为 leave-counted-as-consumed（不能退化为曲目不匹配）',
      zhangming.type,
      'leave-counted-as-consumed'
    ),
    assertIncludes(
      '【关键】描述仍应包含"请假课时被误算为已消耗"（不能只剩冲突编号）',
      zhangming.description,
      '请假课时被误算为已消耗'
    ),
    assertEqual(
      '复核后 status 应为 reviewed',
      zhangming.status,
      'reviewed'
    ),
    assertIncludes(
      '复核后 currentStatus 应显示"巡演统筹已复核"',
      zhangming.currentStatus,
      '巡演统筹已复核'
    ),
    assertIncludes(
      'processingJudgment 应包含"确认为请假，课时不计入已消耗"',
      zhangming.processingJudgment || '',
      '确认为请假'
    ),
    assertIncludes(
      'conclusion 应包含"请假已复核通过"',
      zhangming.conclusion || '',
      '请假已复核通过'
    ),
    assertIncludes(
      'suggestion 仍应保留"请假课时不应计入已消耗"',
      zhangming.suggestion,
      '请假课时不应计入已消耗'
    ),
    assertEqual(
      'handledBy 应为 巡演统筹老王',
      zhangming.handledBy,
      '巡演统筹老王'
    )
  );

  if (zhangming.scheduleEvidence) {
    allResults.push(
      assertEqual(
        '【关键】排班证据仍然保留：isConsumed=true',
        zhangming.scheduleEvidence.isConsumed,
        true
      )
    );
  }

  console.log('\n【阶段 5】复核后 - 导出核对表验证');
  const exportAfter = checklistService.exportChecklist('wrong-caliber');
  const zhangmingExportAfter = exportAfter.find(
    (r: any) => r['艺人'] === '张明'
  );
  if (zhangmingExportAfter) {
    console.table(zhangmingExportAfter);
    allResults.push(
      assertIncludes(
        '导出"原始冲突类型"复核后仍为请假误算',
        zhangmingExportAfter['原始冲突类型'],
        '请假课时被误算为已消耗'
      ),
      assertIncludes(
        '导出"原始冲突描述"复核后仍完整保留',
        zhangmingExportAfter['原始冲突描述'],
        '请假课时被误算为已消耗'
      ),
      assertIncludes(
        '导出"处理结论"包含"请假已复核通过"',
        zhangmingExportAfter['处理结论'],
        '请假已复核通过'
      ),
      assertEqual(
        '导出"处理人"为 巡演统筹老王',
        zhangmingExportAfter['处理人'],
        '巡演统筹老王'
      )
    );
  }

  console.log('\n【阶段 6】审计追踪验证');
  const audits = dataStore.getAuditLog('checklist-item', zhangmingItem.id);
  console.log(`  共 ${audits.length} 条审计记录`);
  for (const audit of audits) {
    console.log(`    [${audit.action}] ${audit.description}`);
    if (audit.before) console.log(`      改前: ${JSON.stringify(audit.before)}`);
    console.log(`      改后: ${JSON.stringify(audit.after)}`);
  }
  allResults.push(
    assertEqual('审计记录数 ≥ 2（创建 + 复核）', audits.length >= 2, true)
  );

  console.log('\n【阶段 7】自检 + 工作流完成验证');
  const selfReport = selfCheckService.runFullCheck();
  const leaveCheck = selfReport.items.find(
    (i) => i.checkType === 'leave-counted-as-consumed'
  );
  console.log(`  自检请假误算项状态: ${leaveCheck?.status}`);

  const canComplete = workflowService.canComplete(workflow.batchId);
  console.log(`  工作流完成状态: ${canComplete.canComplete ? '✅ 可以完成' : '❌ ' + canComplete.reason}`);
  allResults.push(
    assertEqual(
      '统筹复核后工作流应可以完成',
      canComplete.canComplete,
      true
    )
  );

  console.log('\n【阶段 8】刷新/重算后验证（模拟用户刷新页面）');
  const recalcResult = scheduleImportService.recalculateConsumedHours(workflow.batchId);
  console.log(`  重算影响 ${recalcResult.updated.length} 条记录`);

  report = checklistService.getConflictReport();
  zhangming = findZhangmingLeaveConflict(report);
  allResults.push(
    assertEqual(
      '【关键】刷新重算后冲突类型仍为 leave-counted-as-consumed',
      zhangming.type,
      'leave-counted-as-consumed'
    ),
    assertIncludes(
      '【关键】刷新重算后描述仍完整保留',
      zhangming.description,
      '请假课时被误算为已消耗'
    ),
    assertEqual(
      '刷新重算后 status 仍为 reviewed',
      zhangming.status,
      'reviewed'
    )
  );

  const passedCount = allResults.filter((r) => r.passed).length;
  const allPassed = passedCount === allResults.length;

  console.log('\n' + '═'.repeat(70));
  console.log(`专项测试结果：${passedCount}/${allResults.length} 断言通过`);
  console.log('═'.repeat(70));

  if (!allPassed) {
    console.error('\n❌ 存在断言失败，请查看上方日志');
  } else {
    console.log('\n🎉 所有断言通过！张明请假误算冲突类型全程保留，未退化为曲目不匹配。');
  }

  return { allPassed, results: allResults };
}

if (require.main === module) {
  const result = runZhangmingLeaveTest();
  process.exit(result.allPassed ? 0 : 1);
}

export { runZhangmingLeaveTest };
