import { useGaitStore } from '../src/store/useGaitStore';
import { MOCK_FRAMES } from '../src/data/mockData';
import { SkeletonPoint, ImportSession, SupplementDiff, ImportRecord } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

function assertEqual(actual: any, expected: any, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`❌ FAIL: ${message}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('\n=== 人体步态康复骨架 - 补录差异闭环测试 ===\n');

const store = useGaitStore.getState();

store.setFrames(MOCK_FRAMES, '阿乔', 'patient_A_gait_2024_06_15.csv');
console.log('--- 步骤1: 首次导入 ---');

const frames1 = useGaitStore.getState().frames;
const sessions1 = useGaitStore.getState().importSessions;

assert(frames1.length === 10, '首次导入后应有10帧数据');
assert(sessions1.length === 1, '首次导入后应有1个导入会话');
assertEqual(sessions1[0].fileName, 'patient_A_gait_2024_06_15.csv', '导入会话文件名应为真实上传文件名');
assertEqual(sessions1[0].mode, 'initial', '首次导入模式应为initial');

const frame0Point0 = frames1[0].points[0];
assert(
  frame0Point0.sourceFile === 'patient_A_gait_2024_06_15.csv',
  `点位sourceFile应为真实文件名，实际为: ${frame0Point0.sourceFile}`,
);
assert(
  frame0Point0.originalValues.sourceFile === 'patient_A_gait_2024_06_15.csv',
  `点位originalValues.sourceFile应为真实文件名`,
);
assert(frame0Point0.importHistory.length === 1, '首次导入后importHistory应有1条记录');
assertEqual(frame0Point0.importHistory[0].fileName, 'patient_A_gait_2024_06_15.csv', 'importHistory记录文件名应为真实文件名');
assertEqual(frame0Point0.importHistory[0].mode, 'initial', 'importHistory记录模式应为initial');

console.log('\n--- 步骤2: 点选点位并添加备注 ---');

const leftWristPoint = frames1[0].points.find(p => p.name === 'left_wrist');
assert(leftWristPoint !== undefined, '应找到left_wrist点位');

store.addNoteToPoint(leftWristPoint!.id, '首次导入后核验，Y轴方向待确认', '阿乔', '首次核验');
const frames2 = useGaitStore.getState().frames;
const leftWristAfterNote = frames2[0].points.find(p => p.name === 'left_wrist');
assert(leftWristAfterNote!.notes.some(n => n.content.includes('首次导入后核验')), '备注应包含刚添加的内容');

console.log('\n--- 步骤3: 补录导入（同一文件名但坐标不同） ---');

const supplementFrames = JSON.parse(JSON.stringify(MOCK_FRAMES.slice(0, 1))) as typeof MOCK_FRAMES;
supplementFrames[0].points = supplementFrames[0].points.map(p => {
  if (p.name === 'left_wrist') {
    return { ...p, x: p.x + 0.05, y: p.y - 0.03, z: p.z + 0.01 };
  }
  if (p.name === 'right_knee') {
    return { ...p, isAnomaly: false, anomalyType: undefined, anomalyNote: undefined };
  }
  return p;
});

const diffs = store.supplementImport(supplementFrames, 'patient_A_gait_correction_2024_06_20.csv', '阿乔');

console.log('\n--- 步骤4: 验证补录差异 ---');

assert(diffs.length > 0, `补录差异应有变化，实际 diffs.length = ${diffs.length}`);

const leftWristDiff = diffs.find(d => d.pointName === 'left_wrist');
assert(leftWristDiff !== undefined, 'left_wrist应有差异记录');
assert(leftWristDiff!.coordinateDistance > 0, `left_wrist坐标应有偏移，实际: ${leftWristDiff!.coordinateDistance}`);
assertEqual(leftWristDiff!.previousSourceFile, 'patient_A_gait_2024_06_15.csv', '补录差异前来源文件名');
assertEqual(leftWristDiff!.newSourceFile, 'patient_A_gait_correction_2024_06_20.csv', '补录差异后来源文件名');

const rightKneeDiff = diffs.find(d => d.pointName === 'right_knee');
assert(rightKneeDiff !== undefined, 'right_knee应有差异记录（异常状态变更）');

console.log('\n--- 步骤5: 验证补录后点位数据 ---');

const frames3 = useGaitStore.getState().frames;
const leftWristAfterSupplement = frames3[0].points.find(p => p.name === 'left_wrist');

assert(
  leftWristAfterSupplement!.sourceFile === 'patient_A_gait_correction_2024_06_20.csv',
  `补录后sourceFile应为补录文件名，实际: ${leftWristAfterSupplement!.sourceFile}`,
);
assert(
  leftWristAfterSupplement!.originalValues.sourceFile === 'patient_A_gait_2024_06_15.csv',
  `补录后originalValues.sourceFile仍应为首次导入文件名`,
);
assert(leftWristAfterSupplement!.importHistory.length === 2, '补录后importHistory应有2条记录');

const supplementHistory = leftWristAfterSupplement!.importHistory[1];
assertEqual(supplementHistory.fileName, 'patient_A_gait_correction_2024_06_20.csv', '补录历史记录文件名');
assertEqual(supplementHistory.mode, 'supplement', '补录历史记录模式应为supplement');
assert(supplementHistory.coordinateDiff !== undefined, '补录历史应有坐标差异');
assert(supplementHistory.coordinateDiff!.delta.distance > 0, '坐标差异偏移距离应大于0');

const supplementNote = leftWristAfterSupplement!.notes.find(n => n.changeType === 'supplement_merge');
assert(supplementNote !== undefined, '应有补录合并类型的备注');
assert(supplementNote!.coordinateDiff !== undefined, '补录备注应有坐标差异');
assertEqual(supplementNote!.originalSourceFile, 'patient_A_gait_correction_2024_06_20.csv', '补录备注的原始来源文件');

const firstNote = leftWristAfterSupplement!.notes.find(n => n.content.includes('首次导入后核验'));
assert(firstNote !== undefined, '补录后首次添加的备注仍应保留');

console.log('\n--- 步骤6: 验证导入会话 ---');

const sessions2 = useGaitStore.getState().importSessions;
assertEqual(sessions2.length, 2, '补录后应有2个导入会话');
assertEqual(sessions2[0].mode, 'initial', '第1个会话为首次导入');
assertEqual(sessions2[1].mode, 'supplement', '第2个会话为补录导入');
assertEqual(sessions2[1].fileName, 'patient_A_gait_correction_2024_06_20.csv', '补录会话文件名');

console.log('\n--- 步骤7: 验证操作日志 ---');

const logs = useGaitStore.getState().actionLogs;
const importLogs = logs.filter(l => l.actionType === 'import_data');
const supplementLogs = logs.filter(l => l.actionType === 'supplement_import');

assert(importLogs.length >= 1, '应有首次导入操作日志');
assert(supplementLogs.length >= 1, '应有补录导入操作日志');
assert(
  supplementLogs[0].description.includes('patient_A_gait_correction_2024_06_20.csv'),
  '补录日志应包含真实文件名',
);
assert(supplementLogs[0].details?.fileName === 'patient_A_gait_correction_2024_06_20.csv', '补录日志details应包含真实文件名');

console.log('\n--- 步骤8: 验证right_knee异常状态变更 ---');

const rightKneeAfter = frames3[0].points.find(p => p.name === 'right_knee');
assertEqual(rightKneeAfter!.isAnomaly, false, '补录后right_knee应为正常');
assert(
  rightKneeAfter!.importHistory.length >= 2,
  'right_knee应有至少2条导入历史',
);
const rkSupplement = rightKneeAfter!.importHistory.find(h => h.mode === 'supplement');
assert(rkSupplement !== undefined, 'right_knee应有补录历史记录');
assert(rkSupplement!.anomalyDiff !== undefined, 'right_knee补录历史应有异常差异');
assertEqual(rkSupplement!.anomalyDiff!.previous, true, '补录前right_knee为异常');
assertEqual(rkSupplement!.anomalyDiff!.current, false, '补录后right_knee为正常');

console.log('\n--- 步骤9: 验证首次导入文件名在整个链路中可追溯 ---');

const allPointsFrame0 = frames3[0].points;
const pointsFromInitial = allPointsFrame0.filter(
  p => p.originalValues.sourceFile === 'patient_A_gait_2024_06_15.csv',
);
assert(
  pointsFromInitial.length === allPointsFrame0.length,
  `所有点位的originalValues.sourceFile应指向首次导入文件，实际只有${pointsFromInitial.length}/${allPointsFrame0.length}`,
);

const leftWristSources = leftWristAfterSupplement!.importHistory.map(h => h.fileName);
assert(
  leftWristSources.includes('patient_A_gait_2024_06_15.csv'),
  'left_wrist的导入历史应包含首次导入文件名',
);
assert(
  leftWristSources.includes('patient_A_gait_correction_2024_06_20.csv'),
  'left_wrist的导入历史应包含补录文件名',
);

console.log('\n--- 步骤10: 验证导出数据完整性 ---');

const exportData = JSON.parse(JSON.stringify(frames3));
const exportedLeftWrist = exportData[0].points.find((p: SkeletonPoint) => p.name === 'left_wrist');
assert(exportedLeftWrist.sourceFile === 'patient_A_gait_correction_2024_06_20.csv', '导出数据中sourceFile应为补录文件名');
assert(exportedLeftWrist.originalValues.sourceFile === 'patient_A_gait_2024_06_15.csv', '导出数据中originalValues.sourceFile应为首次导入文件名');
assert(exportedLeftWrist.importHistory.length === 2, '导出数据中importHistory应有2条');
assert(exportedLeftWrist.notes.length >= 2, '导出数据中应保留所有备注');

console.log('\n=== 全部测试通过 ===\n');
console.log('关键验证项总结：');
console.log('  1. 真实上传文件名记录到sourceFile和originalValues.sourceFile');
console.log('  2. 补录不覆盖原始数据，originalValues保留首次导入值');
console.log('  3. importHistory完整记录每次导入（首次+补录）');
console.log('  4. 补录差异包含坐标差异、异常差异、来源变更');
console.log('  5. 操作日志记录真实文件名和变更点数');
console.log('  6. 导出数据保留完整来源追溯链路');
