import { store } from '../store';
import { runFilter, reRunFilter, decideResult } from '../engine/filterEngine';
import {
  generateCounterExamplesForRun,
  regenerateCounterExamplesForNote,
} from '../engine/counterExampleGenerator';
import {
  SurveyRawRow,
  BoundaryNote,
  User,
  DemoData,
} from '../types';

const demoUsers: Omit<User, 'id'>[] = [
  { name: '小穆', role: 'assistant' },
  { name: '张老师', role: 'teacher' },
  { name: '李老师', role: 'teacher' },
  { name: '王主任', role: 'admin' },
];

const demoSurveyRows: Array<Omit<SurveyRawRow, 'id'>> = [
  {
    questionId: 'Q001',
    questionText: '你对本次实验课的整体满意度如何？',
    respondentId: 'S2024001',
    respondentName: '张三',
    answer: '非常满意',
    answerValue: 5,
    mainProcess: '学生按步骤完成实验，操作规范，数据记录完整，最后提交的实验报告质量较高',
    timestamp: '2024-06-01T10:30:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
  {
    questionId: 'Q001',
    questionText: '你对本次实验课的整体满意度如何？',
    respondentId: 'S2024002',
    respondentName: '李四',
    answer: '一般',
    answerValue: 3,
    mainProcess: '学生实验过程中多次操作失误，数据偏差较大，最后提交的报告不完整',
    timestamp: '2024-06-01T10:35:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
  {
    questionId: 'Q001',
    questionText: '你对本次实验课的整体满意度如何？',
    respondentId: 'S2024003',
    respondentName: '王五',
    answer: '满意',
    answerValue: 4,
    mainProcess: '学生实验过程顺利，但在关键步骤有停顿，最终结果正确',
    timestamp: '2024-06-01T10:40:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
  {
    questionId: 'Q001',
    questionText: '你对本次实验课的整体满意度如何？',
    respondentId: 'S2024004',
    respondentName: '赵六',
    answer: '一般',
    answerValue: 3,
    mainProcess: '学生操作娴熟，数据准确，但报告中对误差分析不够深入',
    timestamp: '2024-06-01T10:45:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
  {
    questionId: 'Q001',
    questionText: '你对本次实验课的整体满意度如何？',
    respondentId: 'S2024005',
    respondentName: '钱七',
    answer: '不满意',
    answerValue: 2,
    mainProcess: '学生多次向助教提问，实验完成时间比其他人多一倍',
    timestamp: '2024-06-01T10:50:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
  {
    questionId: 'Q001',
    questionText: '你对本次实验课的整体满意度如何？',
    respondentId: 'S2024006',
    respondentName: '孙八',
    answer: '一般',
    answerValue: 3,
    mainProcess: '',
    timestamp: '2024-06-01T10:55:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
  {
    questionId: 'Q002',
    questionText: '实验设备是否满足教学需求？',
    respondentId: 'S2024001',
    respondentName: '张三',
    answer: '完全满足',
    answerValue: 5,
    mainProcess: '设备运行正常，学生操作顺利，没有出现故障',
    timestamp: '2024-06-01T11:00:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
  {
    questionId: 'Q002',
    questionText: '实验设备是否满足教学需求？',
    respondentId: 'S2024002',
    respondentName: '李四',
    answer: '基本满足',
    answerValue: 4,
    mainProcess: '设备需要预热，等待约10分钟后正常使用',
    timestamp: '2024-06-01T11:05:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
  {
    questionId: 'Q002',
    questionText: '实验设备是否满足教学需求？',
    respondentId: 'S2024003',
    respondentName: '王五',
    answer: '不满足',
    answerValue: 2,
    mainProcess: '设备出现故障，学生换了一台设备才完成实验',
    timestamp: '2024-06-01T11:10:00.000Z',
    importedBy: '小穆',
    importedAt: '2024-06-02T09:00:00.000Z',
  },
];

const demoBoundaryNotes: Array<Omit<BoundaryNote, 'id'>> = [
  {
    questionId: 'Q001',
    fieldStatement: '现场观察：该生实验中途请假离开15分钟，回来后直接抄了邻座的数据',
    threshold: 0.5,
    operator: '>=',
    notedBy: '张老师',
    notedAt: '2024-06-01T12:00:00.000Z',
    supplementary: '已和该生谈话，承认数据不真实',
  },
  {
    questionId: 'Q002',
    fieldStatement: '现场说法：3号实验台电压表接触不良，当天已报修',
    threshold: 0.5,
    operator: '>=',
    notedBy: '小穆',
    notedAt: '2024-06-01T14:30:00.000Z',
  },
];

export function initDemoData(): void {
  store.reset();

  for (const user of demoUsers) {
    store.addUser(user);
  }

  for (const row of demoSurveyRows) {
    const savedRow = store.addSurveyRow(row);
    store.addAuditLog({
      entityType: 'survey_row',
      entityId: savedRow.id,
      action: 'import',
      actor: '小穆',
      actorRole: 'assistant',
      changeDescription: `导入问卷原始行 - ${savedRow.questionId} / ${savedRow.respondentName}`,
      newValue: savedRow as unknown as Record<string, unknown>,
      reason: '实验助理小穆批量导入问卷数据',
      timestamp: row.importedAt,
    });
  }

  for (const note of demoBoundaryNotes) {
    const savedNote = store.addBoundaryNote(note);
    store.addAuditLog({
      entityType: 'boundary_note',
      entityId: savedNote.id,
      action: 'create',
      actor: note.notedBy,
      actorRole: note.notedBy === '小穆' ? 'assistant' : 'teacher',
      changeDescription: `录入边界值说明 - ${savedNote.fieldStatement.slice(0, 30)}...`,
      newValue: savedNote as unknown as Record<string, unknown>,
      reason: `${note.notedBy} 补充现场观察记录`,
      timestamp: note.notedAt,
    });
  }
}

export function runDemoWorkflow(): {
  step1: ReturnType<typeof runFilter>;
  step2: ReturnType<typeof generateCounterExamplesForRun>;
  step3: { noteId: string; updated: unknown[]; added: unknown[] };
  step4: ReturnType<typeof runFilter>;
  step5: ReturnType<typeof decideResult>;
} {
  initDemoData();
  console.log('\n========== 演示流程开始 ==========\n');

  console.log('【步骤 1】第一次运行互信息筛选');
  console.log('  导入问卷原始行，暂不使用边界值说明');
  console.log();
  const step1 = runFilter({
    triggeredBy: '小穆',
    boundaryNoteIds: [],
  });
  console.log(`  完成！共处理 ${step1.summary.total} 条记录`);
  console.log(`  - 正常: ${step1.summary.normal}`);
  console.log(`  - 待复核: ${step1.summary.pendingReview}`);
  console.log(`  - 异常: ${step1.summary.anomaly}`);
  console.log(`  - 边界值恰好等于阈值: ${step1.summary.atThreshold}`);
  console.log();

  console.log('【步骤 2】生成反例列表');
  console.log('  每条反例包含：为什么被留下、缺什么材料、下一步找谁');
  console.log();
  const step2 = generateCounterExamplesForRun(step1.run.id, step1.results);
  console.log(`  生成 ${step2.length} 条反例`);
  for (let i = 0; i < Math.min(3, step2.length); i++) {
    const ex = step2[i];
    console.log(`  ${i + 1}. ${ex.respondentName} - ${ex.reasonKept.slice(0, 50)}...`);
    console.log(`     缺: ${ex.missingMaterials.join(', ') || '无'}`);
    console.log(`     下一步: 找${ex.nextHandler}`);
  }
  console.log();

  console.log('【步骤 3】实验助理小穆补录边界值说明');
  console.log('  补录后，反例列表自动更新');
  console.log();
  const newNote = store.addBoundaryNote({
    questionId: 'Q001',
    respondentId: 'S2024002',
    fieldStatement: '现场说法：李四同学当天身体不适，实验中途休息了10分钟',
    threshold: 0.5,
    operator: '>=',
    notedBy: '小穆',
    notedAt: new Date().toISOString(),
    supplementary: '已确认情况属实，该生平时表现良好',
  });
  store.addAuditLog({
    entityType: 'boundary_note',
    entityId: newNote.id,
    action: 'create',
    actor: '小穆',
    actorRole: 'assistant',
    changeDescription: `补录边界值说明 - ${newNote.fieldStatement}`,
    newValue: newNote as unknown as Record<string, unknown>,
    reason: '实验助理小穆复核反例列表后，补充现场观察记录',
    timestamp: new Date().toISOString(),
  });

  const regenResult = regenerateCounterExamplesForNote(newNote.id, '小穆');
  console.log(`  补录边界值说明后：`);
  console.log(`  - 更新反例: ${regenResult.updated.length} 条`);
  console.log(`  - 新增反例: ${regenResult.added.length} 条`);
  console.log();

  console.log('【步骤 4】小穆触发重跑筛选');
  console.log('  使用更新后的边界值说明重新计算');
  console.log();
  const step4 = reRunFilter(step1.run.id, {
    triggeredBy: '小穆',
  });
  console.log(`  完成！共处理 ${step4.summary.total} 条记录`);
  console.log(`  - 正常: ${step4.summary.normal}`);
  console.log(`  - 待复核: ${step4.summary.pendingReview}`);
  console.log(`  - 异常: ${step4.summary.anomaly}`);
  console.log(`  - 有两边证据: ${step4.summary.withBothEvidence}`);
  console.log(`  - 只有主流程: ${step4.summary.withMainProcessOnly}`);
  console.log(`  - 只有现场说法: ${step4.summary.withFieldStatementOnly}`);
  console.log();

  console.log('【步骤 5】任课老师人工复核');
  console.log('  张老师复核边界值恰好等于阈值的记录');
  console.log();
  const pendingAtThreshold = step4.results.find(r => r.isAtThreshold);
  let step5Result = undefined;
  if (pendingAtThreshold) {
    console.log(`  找到边界值恰好等于阈值的记录: ${pendingAtThreshold.respondentName}`);
    console.log(`  互信息得分: ${pendingAtThreshold.mutualInfoScore} = 阈值: ${pendingAtThreshold.threshold}`);
    console.log(`  按规则留给任课老师张老师复核，不自动归类`);
    console.log();
    step5Result = decideResult(
      pendingAtThreshold.id,
      'approve_normal',
      '张老师',
      '经核实，该生虽然数据一般，但态度认真，给予通过'
    );
    console.log(`  张老师复核完成，判定为正常`);
  }
  console.log();

  console.log('========== 演示流程结束 ==========\n');

  return {
    step1,
    step2,
    step3: { noteId: newNote.id, ...regenResult },
    step4,
    step5: step5Result,
  };
}

export function exportDemoData(): DemoData {
  return {
    users: store.getUsers(),
    surveyRows: store.getSurveyRows(),
    boundaryNotes: store.getBoundaryNotes(),
    auditLogs: store.getAuditLogs(),
    filterRuns: store.getFilterRuns(),
    results: store.getFilterResults(),
    counterExamples: store.getCounterExamples(),
  };
}

export function printDemoSummary(): void {
  const data = exportDemoData();

  console.log('\n========== 演示数据总览 ==========\n');
  console.log(`用户: ${data.users.length} 人`);
  console.log(`问卷原始行: ${data.surveyRows.length} 条`);
  console.log(`边界值说明: ${data.boundaryNotes.length} 条`);
  console.log(`筛选运行: ${data.filterRuns.length} 次`);
  console.log(`筛选结果: ${data.results.length} 条`);
  console.log(`反例列表: ${data.counterExamples.length} 条`);
  console.log(`审计日志: ${data.auditLogs.length} 条`);
  console.log();

  console.log('---------- 反例列表详情 ----------\n');
  data.counterExamples.forEach((ex, idx) => {
    const statusLabel = ex.status === 'open' ? '🔴 待处理' :
      ex.status === 'in_progress' ? '🟡 处理中' : '🟢 已解决';
    const actionLabel = ex.nextAction === 'contact_teacher' ? '找任课老师' :
      ex.nextAction === 'contact_assistant' ? '找实验助理小穆' :
      ex.nextAction === 'collect_more' ? '补充材料' : '已解决';

    console.log(`${idx + 1}. ${statusLabel} ${ex.respondentName}`);
    console.log(`   原因: ${ex.reasonKept}`);
    console.log(`   缺材料: ${ex.missingMaterials.length > 0 ? ex.missingMaterials.join('、') : '无'}`);
    console.log(`   下一步: ${actionLabel} → ${ex.nextHandler}`);
    console.log(`   证据:`);
    if (ex.evidence.mainProcess) {
      console.log(`     📋 主流程: ${ex.evidence.mainProcess.slice(0, 60)}${ex.evidence.mainProcess.length > 60 ? '...' : ''}`);
    }
    if (ex.evidence.fieldStatement) {
      console.log(`     🎤 现场说法: ${ex.evidence.fieldStatement.slice(0, 60)}${ex.evidence.fieldStatement.length > 60 ? '...' : ''}`);
    }
    console.log();
  });

  console.log('---------- 审计日志（最近5条） ----------\n');
  data.auditLogs.slice(0, 5).forEach((log, idx) => {
    const actorEmoji = log.actorRole === 'teacher' ? '👨‍🏫' :
      log.actorRole === 'assistant' ? '👩‍💼' : '👤';
    console.log(`${idx + 1}. ${actorEmoji} ${log.actor} ${log.changeDescription}`);
    console.log(`   原因: ${log.reason}`);
    console.log(`   时间: ${new Date(log.timestamp).toLocaleString('zh-CN')}`);
    if (log.impactResults && log.impactResults.length > 0) {
      console.log(`   影响: ${log.impactResults.length} 条结果`);
    }
    console.log();
  });
}
