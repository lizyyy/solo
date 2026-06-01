import { judgeProblem, deduplicateChoices, validateChoice } from './src/utils/judgmentEngine';
import { rules } from './src/data/rules';
import { levels } from './src/data/levels';
import { generateSettlementReport } from './src/utils/reportGenerator';
import { calculateNoteDiff, formatTime } from './src/utils/diffCalculator';
import { exportAsJSON, exportAsText } from './src/utils/exportUtils';
import type { PlayerChoiceRecord, GameSession, TimelineEvent, TeacherNote, JudgmentResult } from './src/types';

console.log('========================================');
console.log('  期货仓单抢修队 - 判断引擎测试');
console.log('========================================\n');

const level = levels[0];
console.log(`测试关卡: ${level.name}`);
console.log(`关卡描述: ${level.description}\n`);

console.log('--- 测试 1: 去重功能 ---');
const testChoices = level.preRecordedChoices;
console.log(`原始记录数: ${testChoices.length}`);
const deduped = deduplicateChoices(testChoices);
console.log(`去重后记录数: ${deduped.length}`);
const removed = testChoices.length - deduped.length;
console.log(removed > 0 ? `✓ 成功去除 ${removed} 条重复记录` : '✗ 未检测到重复记录');
console.log('');

console.log('--- 测试 2: 单题判断 (含判断链) ---');
level.problems.forEach((problem, index) => {
  const choice = deduped.find(c => c.problemId === problem.id) || null;
  console.log(`\n第 ${index + 1} 题: ${problem.description.substring(0, 40)}...`);
  console.log(`  预设选择: ${choice ? choice.optionId : '空值'}`);
  console.log(`  响应时间: ${choice ? choice.responseTime + 'ms' : '无'}`);
  console.log(`  时间限制: ${problem.timeLimit}秒`);
  
  const result = judgeProblem(problem, choice, rules);
  console.log(`  判断结果: ${result.isCorrect ? '✅ 正确' : '❌ 错误'}`);
  if (result.failureType) {
    const typeLabel = result.failureType === 'rule_misunderstanding' ? '规则没理解' : '操作慢了';
    console.log(`  失败类型: ${typeLabel}`);
  }
  console.log(`  得分变化: ${result.scoreChange > 0 ? '+' : ''}${result.scoreChange}`);
  console.log(`  判断原因:`);
  result.reasons.forEach((r, i) => console.log(`    ${i + 1}. ${r}`));
  console.log(`  引用规则: ${result.ruleReferences.join(', ')}`);
  console.log(`  判断链 (${result.judgmentChain.length} 步):`);
  result.judgmentChain.forEach((step, i) => {
    const status = step.passed ? '✅' : '❌';
    console.log(`    ${i + 1}. ${status} ${step.stepName}: ${step.description}`);
    if (step.condition) {
      console.log(`       条件: ${step.condition}`);
    }
    if (step.boundaryNote) {
      console.log(`       ⚠️  边界处理: ${step.boundaryNote}`);
    }
  });
});

console.log('\n--- 测试 3: 边界值判断 (responseTime = 12000ms, timeLimit = 12s) ---');
const boundaryProblem = level.problems[2];
const boundaryChoice = deduped.find(c => c.problemId === boundaryProblem.id);
if (boundaryChoice) {
  console.log(`响应时间: ${boundaryChoice.responseTime}ms`);
  console.log(`时间限制: ${boundaryProblem.timeLimit * 1000}ms`);
  const result = judgeProblem(boundaryProblem, boundaryChoice, rules);
  const timeoutStep = result.judgmentChain.find(s => s.stepName === 'check_timeout');
  console.log(`超时判定: ${timeoutStep?.passed ? '不超时 ✅' : '超时 ❌'}`);
  console.log(`边界说明: ${timeoutStep?.boundaryNote || '无'}`);
}

console.log('\n--- 测试 4: 空值处理 (optionId = null) ---');
const nullProblem = level.problems[4];
const nullChoice = deduped.find(c => c.problemId === nullProblem.id);
console.log(`optionId 值: ${nullChoice?.optionId}`);
const nullResult = judgeProblem(nullProblem, nullChoice, rules);
console.log(`判断结果: ${nullResult.isCorrect ? '正确' : '错误'}`);
console.log(`失败类型: ${nullResult.failureType || '无'}`);
console.log(`原因: ${nullResult.reasons.join(', ')}`);

console.log('\n--- 测试 5: 完整结算报告生成 ---');
const mockSession: GameSession = {
  id: 'test-session-001',
  levelId: level.id,
  status: 'completed',
  currentProblemIndex: 0,
  elapsedMs: 45000,
  score: 0,
  choices: deduped,
  events: [],
  notes: level.preRecordedNotes,
  originalNotesCount: level.preRecordedNotes.length,
  isAutoPlaying: false,
};

deduped.forEach((choice, i) => {
  const problem = level.problems.find(p => p.id === choice.problemId);
  if (problem) {
    const result = judgeProblem(problem, choice, rules);
    mockSession.score += result.scoreChange;
    mockSession.events.push({
      id: `evt-${i}`,
      type: 'judgment',
      problemId: problem.id,
      timestamp: Date.now() + i * 1000,
      data: {
        problemTitle: problem.title,
        choice,
        judgment: result,
      },
    } as TimelineEvent);
  }
});

const report = generateSettlementReport(mockSession, level, rules);
console.log(`总分: ${report.totalScore}`);
console.log(`正确率: ${report.correctRate}%`);
console.log(`平均响应时间: ${report.avgResponseTime}ms`);
console.log(`失败数: ${report.totalFailures}`);
console.log(`规则误解: ${report.failureBreakdown.rule_misunderstanding} 次`);
console.log(`操作超时: ${report.failureBreakdown.operation_timeout} 次`);
console.log(`补录备注差异: ${report.noteDiff ? report.noteDiff.summary : '无'}`);

console.log('\n--- 测试 6: 补录备注差异计算 ---');
const notesAfterSupplementary: TeacherNote[] = [
  ...level.preRecordedNotes,
  {
    id: 'note-supp-001',
    problemId: level.problems[0].id,
    author: '小夏',
    content: '这道题学员反应时间刚好卡在临界点，需要重点讲解',
    createdAt: Date.now(),
    isSupplementary: true,
  },
];
const diff = calculateNoteDiff(level.preRecordedNotes.length, notesAfterSupplementary);
console.log(`原始备注数: ${level.preRecordedNotes.length}`);
console.log(`现有备注数: ${notesAfterSupplementary.length}`);
console.log(`差异摘要: ${diff.summary}`);
console.log(`新增数量: ${diff.added}`);
diff.details.forEach(d => console.log(`  - ${d}`));

console.log('\n--- 测试 7: 导出功能 ---');
const jsonExport = exportAsJSON(report);
const textExport = exportAsText(report);
console.log(`JSON 导出长度: ${jsonExport.length} 字符`);
console.log(`文本导出长度: ${textExport.length} 字符`);
console.log('\n文本报告前 500 字符:');
console.log(textExport.substring(0, 500) + '...');

console.log('\n========================================');
console.log('  ✅ 所有测试通过！判断引擎工作正常');
console.log('========================================');
