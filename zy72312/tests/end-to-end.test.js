#!/usr/bin/env node
/**
 * 凸包围栏面积复核系统 - 端到端测试脚本
 *
 * 覆盖同一条样例从打开入口、导入、补录、保存、刷新、重算、列表、报告到导出的全过程。
 * 所有触发动作、处理判断、状态、历史、报告、导出都来自同一条保存后的复核记录。
 *
 * 重点测试对象：S004 赵六（"暂无"样例 —— 顺时针输入，之前【下一步行动】显示"暂无"）
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { dataStore } from '../src/models/index.js';
import {
  processAllAnswers,
  createReviewRecord,
  updateWithQuestionnaire,
  updateWithManualExample,
  generateReport,
  approveRecord,
  generateReportSummary,
  generateHumanReadableReport
} from '../src/review/engine.js';
import { analyzeGeometry } from '../src/geometry/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const TEST_TMP_DIR = path.resolve(__dirname, '../tmp-test');
const TARGET_STUDENT = 'S004';
const TARGET_ANSWER = 'A001';

let testResults = [];

function test(name, fn) {
  try {
    fn();
    testResults.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testResults.push({ name, passed: false, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(` ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

function cleanup() {
  const files = ['student-answers.json', 'manual-examples.json', 'questionnaires.json', 'review-records.json'];
  files.forEach(f => {
    const p = path.join(DATA_DIR, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
  if (fs.existsSync(TEST_TMP_DIR)) {
    fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });
}

// ========== 启动测试 ==========
console.log('\n🧪 凸包围栏面积复核系统 - 端到端测试');
console.log(`   目标样例：${TARGET_STUDENT} 赵六（顺时针输入，原"暂无"问题样例）`);

cleanup();

// ========== 1. 打开入口，导入学生答案（S004 是顺时针输入的正方形） ==========
section('1. 打开入口 · 导入学生答案');

const sampleAnswersPath = path.join(DATA_DIR, 'sample-student-answers.json');
assert(fs.existsSync(sampleAnswersPath), '样例学生答案文件必须存在');

const answersData = JSON.parse(fs.readFileSync(sampleAnswersPath, 'utf-8'));
const s004Answer = answersData.find(a => a.studentId === TARGET_STUDENT);
assert(s004Answer, '必须存在 S004 赵六的样例答案');
assert(s004Answer.points.length === 4, 'S004 答案应包含 4 个坐标点');

test('S004 原始坐标为顺时针（10×10 正方形，但顺序反了）', () => {
  const expectedPoints = [
    { x: 0, y: 10 },
    { x: 10, y: 10 },
    { x: 10, y: 0 },
    { x: 0, y: 0 }
  ];
  assert.deepStrictEqual(s004Answer.points, expectedPoints, 'S004 坐标顺序与样例不符');
});

test('几何分析：顺时针方向被检测到', () => {
  const geo = analyzeGeometry(s004Answer);
  assert.strictEqual(geo.windingOrder, 'clockwise', '应检测到顺时针');
  assert.strictEqual(geo.isConvex, true, '应为凸多边形');
  assert.strictEqual(geo.rawArea, 100, '面积应为 100');
});

test('导入并保存到数据存储', () => {
  dataStore.loadFromFiles();
  let count = 0;
  answersData.forEach(a => { if (dataStore.addStudentAnswer(a)) count++; });
  dataStore.saveToFiles();
  assert.strictEqual(count, 5, '应成功导入 5 条答案（S001 两版 + S002-S004 各一版）');
});

// ========== 2. 执行复核处理，创建复核记录 ==========
section('2. 执行复核 · 创建复核记录');

test('processAllAnswers 为每个学生+答案创建一条复核记录', () => {
  const records = processAllAnswers();
  assert.strictEqual(records.length, 4, '应为 4 名学生各创建 1 条记录');
});

let s004Record = null;

test(`找到 ${TARGET_STUDENT} 的复核记录`, () => {
  const all = dataStore.getAllReviewRecords();
  s004Record = all.find(r => r.studentId === TARGET_STUDENT && r.answerId === TARGET_ANSWER);
  assert(s004Record, `必须找到 ${TARGET_STUDENT} 的复核记录`);
  assert(s004Record.id, '记录必须有 ID');
});

test('复核记录包含完整的几何分析', () => {
  const geo = s004Record.geometryAnalysis;
  assert(geo, '必须包含 geometryAnalysis');
  assert.strictEqual(geo.windingOrder, 'clockwise', '几何分析中的环绕方向应为顺时针');
  assert.strictEqual(geo.issues.length, 1, '应检测到 1 项几何问题（顺逆时针）');
  assert.strictEqual(geo.issues[0].type, 'winding', '问题类型应为 winding');
});

// ========== 3. 检查初始状态（重点：【下一步行动】不再是"暂无"） ==========
section('3. 初始状态检查 · 修正"暂无"问题');

test('errorAnalysis 不为空，包含几何问题描述', () => {
  assert(s004Record.errorAnalysis, 'errorAnalysis 不能为空');
  assert(s004Record.errorAnalysis.includes('[顺逆时针]'), '误差说明应包含顺逆时针提示');
  assert(s004Record.errorAnalysis.includes('还缺什么材料'), '误差说明应包含"还缺什么材料"');
  assert(s004Record.errorAnalysis.includes('手算反例'), '应指出缺少手算反例');
  assert(s004Record.errorAnalysis.includes('问卷原始行'), '应指出缺少问卷原始行');
});

test('nextStep 不为空，指向"找教研负责人吴老师"', () => {
  assert(s004Record.nextStep, 'nextStep 不能为空');
  assert.strictEqual(s004Record.nextStep, '找教研负责人吴老师');
  assert.strictEqual(s004Record.assignedTo, '找教研负责人吴老师');
});

test('nextStepDetail 不为空（修复"暂无"问题），包含具体动作', () => {
  assert(s004Record.nextStepDetail, 'nextStepDetail 不能为空（关键：原来的"暂无"Bug）');
  assert(s004Record.nextStepDetail.includes('【下一步：找教研负责人吴老师】'), '应包含下一步标题');
  assert(s004Record.nextStepDetail.includes('缺少手算反例'), '应说明缺手算反例的动作');
  assert(s004Record.nextStepDetail.includes('缺少问卷原始行'), '应说明缺问卷的动作');
  assert(s004Record.nextStepDetail.length > 100, 'nextStepDetail 应有足够的详细说明');
});

test('初始状态为 pending，未自动归正常', () => {
  assert.strictEqual(s004Record.status, 'pending');
});

test('历史记录包含创建条目与原因', () => {
  assert(s004Record.reviewHistory.length >= 1, '至少有 1 条历史记录');
  const createEntry = s004Record.reviewHistory.find(h => h.action === 'created');
  assert(createEntry, '必须有 created 动作');
  assert(createEntry.createReason, '必须有创建原因');
  assert(createEntry.createReason.includes('缺手算反例'), '创建原因应包含缺材料说明');
});

// ========== 4. 查看相关列表，确认同一份数据一致 ==========
section('4. 列表一致性检查 · 多视图同一份数据');

test('getAllReviewRecords 返回的 S004 与内存对象一致', () => {
  const fromList = dataStore.getAllReviewRecords().find(r => r.id === s004Record.id);
  assert(fromList, '列表中必须存在该记录');
  assert.strictEqual(fromList.status, s004Record.status, '列表状态与详情必须一致');
  assert.strictEqual(fromList.nextStep, s004Record.nextStep, '列表 nextStep 与详情必须一致');
  assert.strictEqual(fromList.nextStepDetail, s004Record.nextStepDetail, '列表 nextStepDetail 与详情必须一致');
});

test('generateReportSummary 与 record 字段一致', () => {
  const summary = generateReportSummary(s004Record);
  assert.strictEqual(summary.status, s004Record.status);
  assert.strictEqual(summary.nextStep, s004Record.nextStep);
  assert.strictEqual(summary.nextStepDetail, s004Record.nextStepDetail);
  assert.strictEqual(summary.assignedTo, s004Record.assignedTo);
  assert.strictEqual(summary.hasManual, false);
  assert.strictEqual(summary.hasQuestionnaire, false);
});

// ========== 5. 补录问卷原始行（吴老师操作） ==========
section('5. 补录问卷 · 状态与误差自动重算');

const beforeSnapshot = {
  status: s004Record.status,
  errorAnalysis: s004Record.errorAnalysis,
  nextStepDetail: s004Record.nextStepDetail,
  questionnaire: '缺失',
  histCount: s004Record.reviewHistory.length
};

test('补录 S004 问卷原始行（吴老师补看问卷）', () => {
  const qData = {
    id: 'Q-TEST-S004',
    studentId: TARGET_STUDENT,
    answerId: TARGET_ANSWER,
    siteStatement: '赵六当时从东南角开始按顺时针走的，所以坐标顺序反了，实际围栏就是正方形10×10，面积没问题。',
    interviewer: '吴老师',
    additionalNotes: '已核实，顺时针输入属操作顺序问题，不影响面积计算。'
  };
  const updated = updateWithQuestionnaire(s004Record.id, qData);
  assert(updated, '补录后必须返回更新后的记录');
  s004Record = updated;
});

test('补录后状态变更，问卷字段填充', () => {
  assert(s004Record.questionnaire, 'questionnaire 字段必须已填充');
  assert.strictEqual(s004Record.questionnaire.interviewer, '吴老师');
  assert.strictEqual(s004Record.status, 'updated', '状态应从 pending → updated');
  assert.notStrictEqual(s004Record.status, beforeSnapshot.status, '状态必须变化');
});

test('补录后 errorAnalysis 自动重算，不再缺少问卷', () => {
  assert(s004Record.errorAnalysis, 'errorAnalysis 不应为空');
  assert(!s004Record.errorAnalysis.includes('缺少问卷原始行'), '误差说明不应再包含缺问卷');
  // 误差说明中应该有"缺少：手算反例（主流程）"
  assert(
    s004Record.errorAnalysis.includes('手算反例') && s004Record.errorAnalysis.includes('缺少'),
    '仍应指出缺少手算反例。实际 errorAnalysis 内容：\n' + s004Record.errorAnalysis
  );
  assert.notStrictEqual(s004Record.errorAnalysis, beforeSnapshot.errorAnalysis, '误差说明必须变化');
});

test('补录后 nextStepDetail 自动重算，仅缺手算', () => {
  assert(s004Record.nextStepDetail, 'nextStepDetail 不应为空');
  assert(!s004Record.nextStepDetail.includes('缺少问卷原始行'), '下一步不应再提缺问卷');
  assert(s004Record.nextStepDetail.includes('缺少手算反例'), '下一步仍应提示缺手算');
  assert.notStrictEqual(s004Record.nextStepDetail, beforeSnapshot.nextStepDetail, '下一步必须变化');
});

test('历史记录新增"questionnaire-added"条目，带快照对比', () => {
  const hist = s004Record.reviewHistory;
  assert.strictEqual(hist.length, beforeSnapshot.histCount + 1, '应新增 1 条历史');
  const latest = hist[hist.length - 1];
  assert.strictEqual(latest.action, 'questionnaire-added');
  assert(latest.processReason, '必须有处理原因');
  assert(latest.snapshotBefore, '必须有 snapshotBefore');
  assert(latest.snapshotAfter, '必须有 snapshotAfter');
  assert.strictEqual(latest.snapshotBefore.questionnaire, '缺失', '快照前问卷状态应为缺失');
  assert.strictEqual(latest.snapshotAfter.questionnaire, '存在', '快照后问卷状态应为存在');
  assert(latest.snapshotBefore.status !== latest.snapshotAfter.status, '快照中状态必须变化');
});

// ========== 6. 补录手算反例 ==========
section('6. 补录手算 · 双证齐全后进入人工复核');

const beforeSnapshot2 = {
  status: s004Record.status,
  errorAnalysis: s004Record.errorAnalysis,
  nextStepDetail: s004Record.nextStepDetail,
  manualExample: '缺失',
  histCount: s004Record.reviewHistory.length
};

test('补录 S004 手算反例', () => {
  const mData = {
    id: 'M-TEST-S004',
    studentId: TARGET_STUDENT,
    answerId: TARGET_ANSWER,
    expectedArea: 100,
    actualArea: 100,
    reviewer: '吴老师',
    issues: ['顺逆时针问题'],
    notes: '学生按顺时针顺序输入坐标，鞋带公式取绝对值后面积正确，但顺序不符合标准。主流程计算正确。'
  };
  const updated = updateWithManualExample(s004Record.id, mData);
  assert(updated, '补录后必须返回更新后的记录');
  s004Record = updated;
});

test('补录后双证齐全，但不自动归正常，进入人工复核', () => {
  assert(s004Record.manualExample, 'manualExample 必须已填充');
  assert(s004Record.questionnaire, 'questionnaire 必须已填充');
  assert(s004Record.nextStepDetail.includes('【下一步：教研负责人吴老师人工复核】'),
    '双证齐全但仍有几何问题，应进入人工复核，不自动归正常');
  assert(s004Record.nextStepDetail.includes('顺逆时针'), '应提示处理顺逆时针问题');
});

test('误差说明中"还缺什么材料"消失，只剩几何问题', () => {
  assert(!s004Record.errorAnalysis.includes('还缺什么材料'), '材料齐全，误差说明不应再有缺材料');
  assert(s004Record.errorAnalysis.includes('[顺逆时针]'), '仍应包含顺逆时针几何问题');
});

test('历史记录新增"manual-added"条目', () => {
  const hist = s004Record.reviewHistory;
  assert.strictEqual(hist.length, beforeSnapshot2.histCount + 1);
  const latest = hist[hist.length - 1];
  assert.strictEqual(latest.action, 'manual-added');
  assert(latest.snapshotBefore.manualExample === '缺失');
  assert(latest.snapshotAfter.manualExample === '存在');
});

// ========== 7. 批准通过，保留全部痕迹 ==========
section('7. 人工批准 · 不提前归正常，保留全部痕迹');

test('批准 S004，带批注理由', () => {
  const updated = approveRecord(
    s004Record.id,
    '吴老师',
    '顺逆时针问题属操作顺序问题，现场说法与手算反例两边证据均支持面积正确，批注通过。'
  );
  assert(updated);
  s004Record = updated;
});

test('批准后 status 为 approved，但 nextStep/errorAnalysis/历史全部保留', () => {
  assert.strictEqual(s004Record.status, 'approved');
  assert(s004Record.errorAnalysis, 'errorAnalysis 保留，不提前清空');
  assert(s004Record.nextStepDetail, 'nextStepDetail 保留，不提前归正常');
  assert(s004Record.geometryAnalysis.issues.length > 0, '几何问题保留');
});

test('历史记录新增"approved"条目，注明批准时是否有未清事项', () => {
  const hist = s004Record.reviewHistory;
  const latest = hist[hist.length - 1];
  assert.strictEqual(latest.action, 'approved');
  assert.strictEqual(latest.approver, '吴老师');
  assert(latest.reason && latest.reason.length > 0, '必须有批准理由');
  assert(latest.approvedWithConcerns === true, '仍有顺逆时针问题，approvedWithConcerns 应为 true');
  assert(latest.statusChange, '必须有 statusChange 轨迹');
  assert(latest.snapshotBefore && latest.snapshotAfter, '必须保留快照');
});

// ========== 8. 生成正式报告 ==========
section('8. 生成报告 · humanReport 与正式文本一致');

let reportResult = null;

test('generateReport 返回完整结构（record + summary + humanReport）', () => {
  reportResult = generateReport(s004Record.id);
  assert(reportResult, 'generateReport 必须返回结果');
  assert(reportResult.record, '必须包含 record');
  assert(reportResult.summary, '必须包含 summary');
  assert(reportResult.humanReport, '必须包含 humanReport');
});

test('record 字段与最新复核记录完全一致', () => {
  assert.strictEqual(reportResult.record.id, s004Record.id);
  assert.strictEqual(reportResult.record.status, s004Record.status);
  assert.strictEqual(reportResult.record.errorAnalysis, s004Record.errorAnalysis);
  assert.strictEqual(reportResult.record.nextStepDetail, s004Record.nextStepDetail);
  assert.strictEqual(reportResult.record.assignedTo, s004Record.assignedTo);
  assert.strictEqual(reportResult.record.reviewHistory.length, s004Record.reviewHistory.length);
});

test('summary 字段与 generateReportSummary 输出一致', () => {
  const expectedSummary = generateReportSummary(s004Record);
  assert.deepStrictEqual(reportResult.summary, expectedSummary);
});

test('humanReport 为多行正式文本，包含关键信息', () => {
  const hr = reportResult.humanReport;
  assert(typeof hr === 'string');
  const lines = hr.split('\n');
  assert(lines.length >= 25, '正式报告至少 25 行');
  assert(hr.includes('＝＝＝ 凸包围栏面积复核 · 正式报告 ＝＝＝'));
  assert(hr.includes('学生ID：S004'));
  assert(hr.includes('当前状态：approved'));
  assert(hr.includes('环绕方向：clockwise'));
  assert(hr.includes('几何问题共 1 项'));
  assert(hr.includes('[顺逆时针]'), '报告中必须保留几何问题，不提前擦除');
  assert(hr.includes('── 处理历史'), '报告必须包含处理历史');
  assert(hr.includes('approvedWithConcerns') || hr.includes('批准时仍有未清事项'),
    '报告应体现批准时仍有未清事项');
});

test('generateHumanReadableReport 与 report.humanReport 一致', () => {
  const direct = generateHumanReadableReport(s004Record);
  assert.strictEqual(direct, reportResult.humanReport);
});

// ========== 9. 导出报告到文件 ==========
section('9. 导出报告 · 文件内容与内存一致');

const txtOut = path.join(TEST_TMP_DIR, 's004-report.txt');
const jsonOut = path.join(TEST_TMP_DIR, 's004-report.json');

test('导出文本报告到文件', () => {
  fs.writeFileSync(txtOut, reportResult.humanReport, 'utf-8');
  assert(fs.existsSync(txtOut));
  const content = fs.readFileSync(txtOut, 'utf-8');
  assert.strictEqual(content, reportResult.humanReport, '导出的文本必须与内存中完全一致');
});

test('导出JSON报告到文件', () => {
  const jsonContent = JSON.stringify({ record: reportResult.record, summary: reportResult.summary }, null, 2);
  fs.writeFileSync(jsonOut, jsonContent, 'utf-8');
  assert(fs.existsSync(jsonOut));
  const parsed = JSON.parse(fs.readFileSync(jsonOut, 'utf-8'));
  assert.strictEqual(parsed.record.id, s004Record.id);
  assert.strictEqual(parsed.record.nextStepDetail, s004Record.nextStepDetail);
});

// ========== 10. 重新加载后数据一致性 ==========
section('10. 持久化一致性 · 重新加载后数据不变');

test('保存并重新加载数据存储', () => {
  dataStore.saveToFiles();
  dataStore.studentAnswers = [];
  dataStore.reviewRecords = [];
  dataStore.questionnaires = [];
  dataStore.manualExamples = [];
  dataStore.loadFromFiles();
});

test('重新加载后的 S004 记录与批准后完全一致', () => {
  const reloaded = dataStore.getReviewRecord(s004Record.id);
  assert(reloaded, '重新加载后必须能找到该记录');
  assert.strictEqual(reloaded.status, s004Record.status);
  assert.strictEqual(reloaded.errorAnalysis, s004Record.errorAnalysis);
  assert.strictEqual(reloaded.nextStepDetail, s004Record.nextStepDetail);
  assert.strictEqual(reloaded.reviewHistory.length, s004Record.reviewHistory.length);
});

test('generateReport 对重新加载的记录输出相同', () => {
  const reloaded = dataStore.getReviewRecord(s004Record.id);
  const rpt2 = generateReport(reloaded.id);
  assert.strictEqual(rpt2.humanReport, reportResult.humanReport, '不同入口生成的报告必须一致');
});

// ========== 汇总 ==========
section('测试汇总');

const passed = testResults.filter(t => t.passed).length;
const total = testResults.length;

console.log(`\n通过: ${passed}/${total}`);

if (passed < total) {
  console.log('\n失败的测试:');
  testResults.filter(t => !t.passed).forEach(t => {
    console.log(`  - ${t.name}`);
    console.log(`    ${t.error}`);
  });
  process.exit(1);
} else {
  console.log(chalkGreen('\n🎉 所有端到端测试通过！'));
  console.log(`  测试文件: tests/end-to-end.test.js`);
  console.log(`  目标样例: ${TARGET_STUDENT} 赵六（顺时针输入）`);
  console.log(`  覆盖流程: 导入 → 复核 → 列表 → 补录问卷 → 补录手算 → 批准 → 报告 → 导出 → 持久化`);
  console.log(`  关键验证: nextStepDetail 不再为"暂无"，批准后保留全部痕迹`);
  process.exit(0);
}

// 辅助：避免依赖 chalk 又要绿色输出
function chalkGreen(s) {
  return '\x1b[32m' + s + '\x1b[0m';
}
