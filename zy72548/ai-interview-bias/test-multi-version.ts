import {
  parseCorrectionCSV,
  parseInterviewCSV,
  createReviewRecord,
  findCorrectionForSample,
  getCorrectionKey,
  getRelatedRecords,
  runSelfCheck,
} from './src/utils/business';
import type { Role } from './src/types';

const correctionCSV = `样本编号,模型版本,人工评分,人工结论,改判理由,改判人,改判时间
S001,v1.0,70,通过,按v2.0提示词标准评分,运营A,2024-01-20
S001,v1.2,65,通过,v1.2模型输出较保守,运营A,2024-02-15
S002,v1.0,65,通过,表现尚可,运营A,2024-01-20
S003,v1.1,75,通过,需复核模型版本,运营B,2024-01-21
S003,v1.0,72,通过,老模型评分稳定,运营B,2024-01-15`;

const interviewCSV = `样本编号,候选人姓名,面试日期,模型版本,AI评分,AI结论,面试记录
S001,张三,2024-01-15,v1.0,55,不通过,项目经验不足
S001,张三,2024-02-10,v1.2,58,不通过,项目经验描述模糊
S002,李四,2024-01-16,v1.0,62,通过,基础知识扎实
S003,王五,2024-01-17,v1.1,68,通过,技术能力较强
S003,王五,2024-01-10,v1.0,66,通过,表达清晰
S004,赵六,2024-01-18,v1.0,70,通过,算法能力强
S005,孙七,2024-01-19,v1.0,45,不通过,基础薄弱`;

console.log('='.repeat(60));
console.log('端到端验证：多模型版本导入绑定验证');
console.log('='.repeat(60));

const corrections = parseCorrectionCSV(correctionCSV);
console.log('\n✅ 1. 解析人工改判表');
console.log(`   解析到 ${corrections.length} 条改判记录`);
corrections.forEach(c => {
  const key = getCorrectionKey(c.sampleId, c.modelVersion);
  console.log(`   - ${key}: ${c.humanScore}分 / ${c.conclusion} / ${c.reason}`);
});

console.log('\n✅ 2. 验证 findCorrectionForSample 精确匹配');
const testCases = [
  { sampleId: 'S001', modelVersion: 'v1.0', expectedScore: 70, expectedReason: '按v2.0提示词标准评分' },
  { sampleId: 'S001', modelVersion: 'v1.2', expectedScore: 65, expectedReason: 'v1.2模型输出较保守' },
  { sampleId: 'S003', modelVersion: 'v1.1', expectedScore: 75, expectedReason: '需复核模型版本' },
  { sampleId: 'S003', modelVersion: 'v1.0', expectedScore: 72, expectedReason: '老模型评分稳定' },
  { sampleId: 'S002', modelVersion: 'v1.0', expectedScore: 65, expectedReason: '表现尚可' },
];

let allPassed = true;
testCases.forEach(tc => {
  const correction = findCorrectionForSample(corrections, tc.sampleId, tc.modelVersion);
  const passed = correction?.humanScore === tc.expectedScore && correction?.reason === tc.expectedReason;
  allPassed = allPassed && passed;
  const status = passed ? '✅' : '❌';
  console.log(`   ${status} ${tc.sampleId}@${tc.modelVersion}: 期望 ${tc.expectedScore}分, 实际 ${correction?.humanScore}分`);
  if (!passed) {
    console.log(`      期望理由: ${tc.expectedReason}`);
    console.log(`      实际理由: ${correction?.reason}`);
  }
});

console.log('\n✅ 3. 解析面试样本');
const samples = parseInterviewCSV(interviewCSV);
console.log(`   解析到 ${samples.length} 条面试样本`);

console.log('\n✅ 4. 创建复核记录（验证导入时绑定）');
const records = [];
const currentRole: Role = 'product_manager';
samples.forEach(sample => {
  const correction = findCorrectionForSample(corrections, sample.sampleId, sample.modelVersion);
  const record = createReviewRecord(sample, correction, '阿宁', currentRole);
  records.push(record);
  const matchKey = getCorrectionKey(sample.sampleId, sample.modelVersion);
  const correctionKey = correction ? getCorrectionKey(correction.sampleId, correction.modelVersion) : '无';
  console.log(`   - ${matchKey}: AI=${sample.aiScore}分 → 人工=${correction?.humanScore ?? '-'}分, 匹配键=${correctionKey}`);
});

console.log('\n✅ 5. 验证 S001 两个版本独立绑定');
const s001_v10 = records.find(r => r.sampleId === 'S001' && r.interview.modelVersion === 'v1.0');
const s001_v12 = records.find(r => r.sampleId === 'S001' && r.interview.modelVersion === 'v1.2');

console.log(`   S001@v1.0:`);
console.log(`     recordId: ${s001_v10?.recordId}`);
console.log(`     correction.humanScore: ${s001_v10?.correction?.humanScore} (应为70)`);
console.log(`     correction.reason: ${s001_v10?.correction?.reason}`);
console.log(`     历史记录: ${s001_v10?.history.map(h => h.remark).join(' | ')}`);

console.log(`   S001@v1.2:`);
console.log(`     recordId: ${s001_v12?.recordId}`);
console.log(`     correction.humanScore: ${s001_v12?.correction?.humanScore} (应为65)`);
console.log(`     correction.reason: ${s001_v12?.correction?.reason}`);
console.log(`     历史记录: ${s001_v12?.history.map(h => h.remark).join(' | ')}`);

const s001Correct = s001_v10?.correction?.humanScore === 70 &&
                    s001_v12?.correction?.humanScore === 65 &&
                    s001_v10?.recordId !== s001_v12?.recordId;
console.log(`   ${s001Correct ? '✅' : '❌'} S001 两个版本独立绑定${s001Correct ? '' : ' - 失败！'}`);
allPassed = allPassed && s001Correct;

console.log('\n✅ 6. 验证 S003 两个版本独立绑定');
const s003_v11 = records.find(r => r.sampleId === 'S003' && r.interview.modelVersion === 'v1.1');
const s003_v10 = records.find(r => r.sampleId === 'S003' && r.interview.modelVersion === 'v1.0');

console.log(`   S003@v1.1: ${s003_v11?.correction?.humanScore}分 (应为75) - ${s003_v11?.correction?.reason}`);
console.log(`   S003@v1.0: ${s003_v10?.correction?.humanScore}分 (应为72) - ${s003_v10?.correction?.reason}`);

const s003Correct = s003_v11?.correction?.humanScore === 75 && s003_v10?.correction?.humanScore === 72;
console.log(`   ${s003Correct ? '✅' : '❌'} S003 两个版本独立绑定${s003Correct ? '' : ' - 失败！'}`);
allPassed = allPassed && s003Correct;

console.log('\n✅ 7. 验证 getRelatedRecords 关联记录');
const related_v10 = getRelatedRecords(s001_v10!, records);
const related_v12 = getRelatedRecords(s001_v12!, records);
console.log(`   S001@v1.0 的关联记录: ${related_v10.map(r => `${r.sampleId}@${r.interview.modelVersion}`).join(', ')}`);
console.log(`   S001@v1.2 的关联记录: ${related_v12.map(r => `${r.sampleId}@${r.interview.modelVersion}`).join(', ')}`);

const relatedCorrect = related_v10.length === 1 && related_v10[0].interview.modelVersion === 'v1.2' &&
                      related_v12.length === 1 && related_v12[0].interview.modelVersion === 'v1.0';
console.log(`   ${relatedCorrect ? '✅' : '❌'} 关联记录正确${relatedCorrect ? '' : ' - 失败！'}`);
allPassed = allPassed && relatedCorrect;

console.log('\n✅ 8. 验证自检 - 重复导入检测');
const selfCheckResults = runSelfCheck(records, []);
const duplicateCheck = selfCheckResults.find(r => r.checkName === '重复导入检测');
console.log(`   重复导入检测: ${duplicateCheck?.passed ? '✅ 通过' : '❌ 未通过'} - ${duplicateCheck?.message}`);

console.log('\n✅ 9. 验证历史留痕包含模型版本和匹配键');
const s001v10History = s001_v10?.history[0]?.remark ?? '';
const s001v12History = s001_v12?.history[0]?.remark ?? '';
const historyCorrect = s001v10History.includes('模型版本 v1.0') &&
                       s001v10History.includes('改判匹配键 S001@v1.0') &&
                       s001v12History.includes('模型版本 v1.2') &&
                       s001v12History.includes('改判匹配键 S001@v1.2');
console.log(`   S001@v1.0 历史: ${s001v10History}`);
console.log(`   S001@v1.2 历史: ${s001v12History}`);
console.log(`   ${historyCorrect ? '✅' : '❌'} 历史留痕包含模型版本和匹配键${historyCorrect ? '' : ' - 失败！'}`);
allPassed = allPassed && historyCorrect;

console.log('\n' + '='.repeat(60));
console.log(`验证结果: ${allPassed ? '✅ 全部通过' : '❌ 存在失败'}`);
console.log('='.repeat(60));

process.exit(allPassed ? 0 : 1);
