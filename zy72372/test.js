console.log('='.repeat(68));
console.log('  弹簧疲劳寿命复核 · 普通使用者路线端到端验证');
console.log('='.repeat(68));

const { SensorDataProcessor } = require('./src/processor');
const { DemoData } = require('./src/demo-data');
const {
  RECORD_STATUS, SAFETY_LEVEL, InspectionSession, SensorRecord
} = require('./src/models');

const processor = new SensorDataProcessor();
let session;
let step = 1;

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}
function fail(msg) {
  console.log(`  ❌ ${msg}`);
  process.exit(1);
}
function check(name, cond, msg) {
  console.log(`\n[验证点 ${step++}] ${name}`);
  if (cond) pass(msg); else fail(msg);
}

/* ============================================================
   步骤 A：工况照片第一次导入
   ============================================================ */
console.log('\n── 步骤A：工况照片第一次导入 ──');

processor.knownSensors = DemoData.getBaselineSensors();
const photoData = DemoData.getPhotoImportData();
const records = processor.importPhotoData(photoData);

session = new InspectionSession({
  id: 'verification-session',
  date: '2026-06-09',
  inspector: '老岑',
  location: 'A区生产线-3号机组',
  photos: photoData.map((p, i) => ({
    id: 'photo-' + i,
    path: p.path,
    description: '弹簧 ' + p.springId + ' 工况照片',
    timestamp: p.timestamp
  })),
  status: 'imported'
});
records.forEach(r => session.addRecord(r.toJSON()));

const firstProcess = processor.processSession(session);

check(
  '工况照片导入成功',
  session.records.length === 3,
  `3 条记录全部导入（实际 ${session.records.length}）`
);

check(
  '传感器编号变化检测正确',
  firstProcess.restartDetections.length === 2 &&
    firstProcess.restartDetections.every(
      d => d.springId === 'A002' || d.springId === 'A003'
    ),
  `A002/A003 两条检测到编号变化（实际 ${firstProcess.restartDetections.length} 条）`
);

const a001 = session.getRecordById(session.records[0].id);
const a002 = session.getRecordById(session.records[1].id);
const a003 = session.getRecordById(session.records[2].id);

check(
  'A001 顺利记录：状态正常',
  a001.status === RECORD_STATUS.NORMAL && !a001.sensorRestartDetected,
  `A001 status=${a001.status}，无重启标记`
);
check(
  'A002 传感器重启：不急着归正常，标记 pending_review',
  a002.status === RECORD_STATUS.PENDING_REVIEW && a002.sensorRestartDetected,
  `A002 status=${a002.status}`
);
check(
  'A003 传感器重启：不急着归正常，标记 pending_review',
  a003.status === RECORD_STATUS.PENDING_REVIEW && a003.sensorRestartDetected,
  `A003 status=${a003.status}`
);

check(
  '第一次安全提醒：「2 条待复核/传感器异常需复核」',
  session.safetyReminder.level === SAFETY_LEVEL.WARNING &&
    session.safetyReminder.title === '传感器异常需复核' &&
    session.safetyReminder.description.includes('2'),
  `安全提醒：level=${session.safetyReminder.level}，` +
    `title="${session.safetyReminder.title}"`
);

/* ============================================================
   步骤 B：补录手写巡检备注（A003）— 改前/改后/原因 + 安全提醒同步
   ============================================================ */
console.log('\n── 步骤B：维修师傅补录手写巡检备注（A003） ──');

const a003OldFatigue = a003.fatigueValue;          // 78
const a003OldStatus = a003.status;                 // pending_review
const a003OldNote = a003.manualNote;               // null
const reminderBeforeNote = JSON.parse(JSON.stringify(session.safetyReminder));

const noteResult = processor.applyManualNote(
  a003.id,
  {
    content: '5月28日手写记录：弹簧A003原传感器SNS-0031损坏，' +
             '已更换新传感器SNS-0031-NEW，疲劳值按旧口径修正为42',
    correctedFatigueValue: 42,
    reason: '更换新传感器后按旧口径折算',
    author: '老岑'
  },
  session
);

check(
  '补录返回 diff：展示改前/改后文本 + 原因',
  noteResult.diff &&
    noteResult.diff.oldFatigue === 78 &&
    noteResult.diff.newFatigue === 42 &&
    noteResult.diff.oldNote === null &&
    noteResult.diff.newNote.includes('5月28日手写记录') &&
    noteResult.diff.reason.includes('按旧口径折算'),
  `diff 完整：${JSON.stringify(noteResult.diff)}`
);

check(
  'A003 状态：from_manual_note，不再是 pending_review',
  a003.status === RECORD_STATUS.FROM_MANUAL_NOTE,
  `A003 status=${a003.status}（此前 ${a003OldStatus}）`
);

check(
  'A003 疲劳值：78 → 42（correctedFatigueValue 生效）',
  a003.correctedFatigueValue === 42 && a003.fatigueValue === 78,
  `原始值 ${a003.fatigueValue}，修正值 ${a003.correctedFatigueValue}`
);

check(
  '补录后安全提醒内容变化（不再出现 A003 在待复核）',
  session.safetyReminder.description.includes('1 条') &&
    session.safetyReminder.description.includes('A002') &&
    !session.safetyReminder.description.includes('A003、') &&
    session.safetyReminder.title === '传感器异常需复核',
  `补录后提醒：${session.safetyReminder.title}；` +
    `${session.safetyReminder.description.split('\n')[0]}`
);

/* ============================================================
   步骤 C：安全员复核（A002）—— 复核意见 + 安全提醒再更新
   ============================================================ */
console.log('\n── 步骤C：安全员复核 A002 ──');

const reminderBeforeReview = JSON.parse(JSON.stringify(session.safetyReminder));

const reviewResult = processor.reviewRecord(
  a002.id,
  {
    comment: '传感器重启后数据偏差在可接受范围内，标记为需持续监测',
    correctedFatigueValue: a002.fatigueValue
  },
  '安全员-老王',
  session
);

check(
  'A002 复核后状态：reviewed',
  a002.status === RECORD_STATUS.REVIEWED &&
    a002.reviewComment &&
    a002.reviewedBy === '安全员-老王',
  `A002 status=${a002.status}，复核人=${a002.reviewedBy}`
);

check(
  '安全提醒最终状态：不再「待复核」，转为「警告：存在需关注的弹簧」',
  session.safetyReminder.level === SAFETY_LEVEL.WARNING &&
    session.safetyReminder.title === '警告：存在需关注的弹簧' &&
    !session.safetyReminder.title.includes('需复核'),
  `最终安全提醒：${session.safetyReminder.level} — ${session.safetyReminder.title}`
);

/* ============================================================
   步骤 D：重跑分析
   ============================================================ */
console.log('\n── 步骤D：重跑分析 ──');

const runCountsBefore = session.records.map(r => r.runCount);
const statusesBefore = session.records.map(r => r.status);
const rerunRes = processor.rerunAnalysis(session);

check(
  '重跑不覆盖 from_manual_note / reviewed 状态',
  session.records[0].status === RECORD_STATUS.NORMAL &&
    session.records[1].status === RECORD_STATUS.REVIEWED &&
    session.records[2].status === RECORD_STATUS.FROM_MANUAL_NOTE,
  `重跑后状态：${session.records.map(r => r.springId + '=' + r.status).join('；')}`
);

check(
  '重跑后运行次数全部 +1',
  session.records.every((r, i) => r.runCount === runCountsBefore[i] + 1),
  `运行次数：${session.records.map(r => r.springId + '=' + r.runCount).join('，')}`
);

/* ============================================================
   核对三个用户关注点
   ============================================================ */
console.log('\n── 收尾：用户关注点核对 ──');

const pendingRemain = session.records.filter(
  r => r.status === RECORD_STATUS.PENDING_REVIEW
);

check(
  '关注点①「有 1 条记录待复核/传感器异常需复核」— 补录+复核后消失',
  pendingRemain.length === 0 &&
    session.safetyReminder.title !== '传感器异常需复核',
  `待复核条数=${pendingRemain.length}，` +
    `安全提醒标题="${session.safetyReminder.title}"`
);

// 这里不再真的启动交互菜单，但可做静态验证：cli.js 里 options 1-6 都有 case
const fs = require('fs');
const cliSource = fs.readFileSync('./src/cli.js', 'utf8');
check(
  '关注点②「无效选项」— 菜单选项 3/4/5/6 都有真实 case 分支',
  ["case '1':", "case '2':", "case '3':", "case '4':",
   "case '5':", "case '6':"].every(k => cliSource.includes(k)) &&
    cliSource.includes('stepApplyManualNote') &&
    cliSource.includes('stepReviewRecord') &&
    cliSource.includes('stepRerun'),
  'cli.js 中 case 1-6 全部绑定到真实实现函数'
);

check(
  '关注点③「补录」— 不只是加备注，状态+修正值+安全提醒都联动',
  a003.manualNote &&
    typeof a003.manualNote === 'object' &&
    a003.manualNote.content.includes('5月28日') &&
    a003.status === RECORD_STATUS.FROM_MANUAL_NOTE &&
    a003.correctedFatigueValue === 42 &&
    reminderBeforeNote.title !== session.safetyReminder.title,
  '补录后：manualNote 存内容、status 改 from_manual_note、correctedFatigueValue=42、安全提醒标题变化'
);

/* ============================================================
   最终总结输出
   ============================================================ */
console.log('\n' + '='.repeat(68));
console.log('  三种处理结果最终对比');
console.log('='.repeat(68));
session.records.forEach(r => {
  const fv = r.correctedFatigueValue !== null
    ? `${r.fatigueValue} → ${r.correctedFatigueValue}`
    : `${r.fatigueValue}`;
  const type =
    r.status === RECORD_STATUS.NORMAL ? '①顺利记录' :
    r.status === RECORD_STATUS.REVIEWED ? '②传感器重启复核' :
    r.status === RECORD_STATUS.FROM_MANUAL_NOTE ? '③手写补录修正' :
    '其他';
  console.log(`  ${type}  ${r.springId}：传感器=${r.sensorId}` +
    (r.sensorRestartDetected ? `（原 ${r.originalSensorId}）` : '') +
    `，疲劳值=${fv}，状态=${r.status}，运行次数=${r.runCount}`);
});

console.log('\n' + '='.repeat(68));
console.log(`  最终安全提醒：${session.safetyReminder.level.toUpperCase()}` +
            ` — ${session.safetyReminder.title}`);
console.log(`  ${session.safetyReminder.description.split('\n')[0]}`);
console.log('='.repeat(68));
console.log('\n✅ 全部验证点通过！');
