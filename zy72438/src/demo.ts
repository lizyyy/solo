import { MidiControllerBackup } from './core';

const app = new MidiControllerBackup();

function banner(title: string) {
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(56)}`);
}

function showState(label: string) {
  const wf = app.getWorkflowState();
  console.log(`  [${label}] 当前步骤：${wf.stepName}`);
  console.log(`  [${label}] 曲目${app.getTracks().length}条 | 签到${app.getCheckins().length}条 | 分账${app.getSplits().length}条 | 未解决冲突${wf.pendingConflicts}个 | 待复核替补${wf.pendingSubstitutes}条`);
}

function showSelfCheck() {
  const checks = app.selfCheck();
  checks.forEach(c => {
    const mark = c.passed ? '✅' : '❌';
    console.log(`  ${mark} ${c.name}: ${c.message}`);
  });
}

function findSunnyTrack() {
  return app.getTracks().find(t => t.trackName === '晴天');
}

function findSunnySplit() {
  return app.getSplits().find(s => s.trackName === '晴天');
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  MIDI控制器映射备份 - 公开演示入口                       ║');
console.log('║  业务样例：晴天 连续导入→重复检测→冲突判断→补录→重算→导出 ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ─── 步骤1：曲目别名表第一次导入 ───
banner('步骤1  曲目别名表第一次导入');
console.log('  操作：导入 夜曲(¥200) + 晴天(¥180)');

const r1 = app.importTrackAliases([
  { trackName: '夜曲', artist: '周杰伦', fee: 200, aliasNames: ['Nocturne'] },
  { trackName: '晴天', artist: '周杰伦', fee: 180, aliasNames: ['Sunny Day'] },
]);

console.log(`  结果：第${r1.batchNumber}批，新增${r1.newRecords}条，重复0条`);
const sunnyV1 = findSunnyTrack();
console.log(`  晴天记录：ID=${sunnyV1!.id}，费用=¥${sunnyV1!.fee}，批次=${sunnyV1!.importBatch}`);
showState('导入后');

banner('步骤1自检');
showSelfCheck();

// ─── 步骤2：再次导入晴天，触发重复 ───
banner('步骤2  再次导入晴天，触发重复导入检测');
console.log('  操作：导入 晴天(¥220，费用变了) + 稻香(¥150，新曲目)');

const r2 = app.importTrackAliases([
  { trackName: '晴天', artist: '周杰伦', fee: 220, aliasNames: ['Sunny Day'] },
  { trackName: '稻香', artist: '周杰伦', fee: 150, aliasNames: ['Rice Field'] },
]);

console.log(`  结果：第${r2.batchNumber}批，新增${r2.newRecords}条，历史重复${r2.duplicatesHistorical}条`);
console.log(`  冲突：`);
r2.conflicts.forEach(c => {
  console.log(`    - [${c.duplicateType}] ${c.message}`);
  console.log(`      已有：¥${c.evidence?.aliasTable?.existing?.fee}（第${c.evidence?.aliasTable?.existing?.importBatch}批）`);
  console.log(`      导入：¥${c.evidence?.aliasTable?.incoming?.fee}（第${c.evidence?.aliasTable?.incoming?.importBatch}批）`);
  console.log(`      关联曲目ID：${c.existingTrackId}`);
});

const dupConflict = r2.conflicts.find(c => c.type === 'duplicate-import');
showState('重复导入后');

banner('步骤2自检（应显示重复导入检测不通过）');
showSelfCheck();

// ─── 步骤3：导入签到，含群里说的临时替补 ───
banner('步骤3  导入课时签到照片（含群里说的临时替补）');
console.log('  操作：导入 小明-夜曲 + 小红-晴天（群里说的替补）');

const r3 = app.importCheckinPhotos([
  { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01' },
  { photoId: 'p2', trackName: '晴天', studentName: '小红', teacherName: '王老师', classDate: '2026-06-01',
    isSubstitute: true, substituteNote: '群里说小李替小王上课', source: 'wechat-group' },
]);

console.log(`  结果：新增${r3.newRecords}条签到`);
const subConflict = app.getConflicts().find(c => c.type === 'substitute-unverified');
if (subConflict) {
  console.log(`  替补冲突：${subConflict.message}`);
  console.log(`    学生=${subConflict.evidence.checkinPhoto.student}，日期=${subConflict.evidence.checkinPhoto.date}，备注=${subConflict.evidence.checkinPhoto.note}`);
}
showState('签到导入后');

// ─── 步骤4：人工补录 — 更新晴天费用 ───
banner('步骤4  人工补录：选择「补录更新费用」晴天 ¥180→¥220');
console.log(`  操作：resolveConflict(${dupConflict!.id}, 'update')`);

const sunnyBefore = findSunnyTrack();
console.log(`  补录前：晴天 ID=${sunnyBefore!.id}，费用=¥${sunnyBefore!.fee}`);

app.resolveConflict(dupConflict!.id, 'update', '录音师小段');

const sunnyAfter = findSunnyTrack();
console.log(`  补录后：晴天 ID=${sunnyAfter!.id}，费用=¥${sunnyAfter!.fee}`);
console.log(`  ID是否不变：${sunnyBefore!.id === sunnyAfter!.id ? '是（同一条记录）' : '否（异常）'}`);
console.log(`  updatedAt=${sunnyAfter!.updatedAt ? new Date(sunnyAfter!.updatedAt!).toLocaleString() : '无'}`);
console.log(`  updatedBy=${sunnyAfter!.updatedBy || '无'}`);

// ─── 步骤5：票务复核替补 ───
banner('步骤5  票务同事复核临时替补');
const subCheckin = app.getCheckins().find(c => c.isSubstitute && !c.verified);
if (subCheckin) {
  app.verifySubstitute(subCheckin.id, '票务同事');
  console.log(`  已复核：${subCheckin.studentName} ${subCheckin.classDate}`);
}

showState('补录+复核后');

// ─── 步骤6：生成分账 ───
banner('步骤6  生成分账明细');
const splits = app.calculateSplit('录音师小段');
splits.forEach(s => {
  console.log(`  ${s.studentName}-${s.trackName}：基础¥${s.baseFee}，替补调整¥${s.substituteAdjustment}，实收¥${s.totalFee}，trackId=${s.trackId.slice(0, 8)}...`);
});
const sunnySplit = findSunnySplit();
console.log(`\n  晴天分账关联曲目ID：${sunnySplit!.trackId}`);
console.log(`  晴天曲目ID：${sunnyAfter!.id}`);
console.log(`  分账→曲目ID一致：${sunnySplit!.trackId === sunnyAfter!.id ? '是' : '否'}`);

// ─── 步骤7：补录后重算 ───
banner('步骤7  补录后重算：晴天费用 ¥220→¥250');
console.log(`  操作：recalculateSplit(${sunnySplit!.id.slice(0, 8)}..., 250)`);

app.recalculateSplit(sunnySplit!.id, 250, '录音师小段');

const sunnySplitV2 = findSunnySplit();
console.log(`  重算后：实收=¥${sunnySplitV2!.totalFee}，版本=v${sunnySplitV2!.version}，备注=${sunnySplitV2!.remark || '无'}`);
console.log(`  分账ID不变：${sunnySplit!.id === sunnySplitV2!.id ? '是（同一条记录）' : '否（异常）'}`);

// ─── 步骤8：保存后刷新 — 验证状态持久 ───
banner('步骤8  保存后刷新（验证当前状态）');
showState('刷新后');

console.log('  曲目表当前状态：');
app.getTracks().forEach(t => {
  const updated = t.updatedAt ? ` [更新于${new Date(t.updatedAt).toLocaleString()} by ${t.updatedBy}]` : '';
  console.log(`    ${t.trackName} - ¥${t.fee}（第${t.importBatch}批）ID=${t.id.slice(0, 8)}...${updated}`);
});

console.log('  分表明细当前状态：');
app.getSplits().forEach(s => {
  console.log(`    ${s.studentName}-${s.trackName} - ¥${s.totalFee}（v${s.version}）trackId=${s.trackId.slice(0, 8)}... splitId=${s.id.slice(0, 8)}...`);
});

console.log('  冲突历史：');
app.getConflicts().forEach(c => {
  console.log(`    [${c.type}] ${c.duplicateType || ''} resolved=${c.resolved} resolution=${c.resolution || '无'} resolver=${c.resolver || '无'}`);
});

banner('步骤8自检');
showSelfCheck();

// ─── 步骤9：导出记录，核对同一条 ───
banner('步骤9  导出数据，核对指向同一条记录');
const exported = app.exportData();

const expSunnyTrack = exported.tracks.find(t => t.trackName === '晴天');
const pageSunnyTrack = findSunnyTrack();
console.log(`  导出晴天ID = 页面晴天ID：${expSunnyTrack!.id === pageSunnyTrack!.id ? '✅ 一致' : '❌ 不一致'}`);
console.log(`  导出晴天费用 = 页面晴天费用：${expSunnyTrack!.fee === pageSunnyTrack!.fee ? '✅ ¥' + expSunnyTrack!.fee : '❌ 不一致'}`);

const expSunnySplit = exported.splits.find(s => s.trackName === '晴天');
const pageSunnySplit = findSunnySplit();
console.log(`  导出分账ID = 页面分账ID：${expSunnySplit!.id === pageSunnySplit!.id ? '✅ 一致' : '❌ 不一致'}`);
console.log(`  导出分账实收 = 页面分账实收：${expSunnySplit!.totalFee === pageSunnySplit!.totalFee ? '✅ ¥' + expSunnySplit!.totalFee : '❌ 不一致'}`);
console.log(`  导出分账trackId = 晴天曲目ID：${expSunnySplit!.trackId === expSunnyTrack!.id ? '✅ 一致' : '❌ 不一致'}`);

console.log(`\n  导出时间：${new Date(exported.exportTime).toLocaleString()}`);
console.log(`  导出总条数：曲目${exported.tracks.length}，签到${exported.checkins.length}，分账${exported.splits.length}，冲突${exported.conflicts.length}`);

// ─── 步骤10：操作历史追溯 ───
banner('步骤10  操作历史追溯（按时间倒序）');
const history = app.getHistory();
history.slice(0, 10).forEach((h, i) => {
  console.log(`  ${i + 1}. [${new Date(h.time).toLocaleTimeString()}] ${h.operator}: ${h.detail}`);
});

// ─── 最终核对总结 ───
banner('最终核对');
const allChecks = app.selfCheck();
const allPass = allChecks.every(c => c.passed);

console.log(`  重复导入检测状态：${allChecks.find(c => c.name === '重复导入检测')!.passed ? '✅ 通过' : '❌ 未通过'}`);
console.log(`  临时替补复核检查：${allChecks.find(c => c.name === '临时替补复核检查')!.passed ? '✅ 通过' : '❌ 未通过'}`);
console.log(`  补录重算一致性：${allChecks.find(c => c.name === '补录重算一致性检查')!.passed ? '✅ 通过' : '❌ 未通过'}`);
console.log(`  导出数据一致性：${allChecks.find(c => c.name === '导出数据一致性检查')!.passed ? '✅ 通过' : '❌ 未通过'}`);

const trackIdConsistent = sunnyAfter!.id === expSunnyTrack!.id
  && sunnySplitV2!.trackId === sunnyAfter!.id
  && sunnySplitV2!.id === expSunnySplit!.id;

console.log(`\n  同一条记录贯穿验证：`);
console.log(`    曲目ID → 分账trackId → 导出曲目ID → 导出分账trackId`);
console.log(`    ${sunnyAfter!.id.slice(0, 8)}... → ${sunnySplitV2!.trackId.slice(0, 8)}... → ${expSunnyTrack!.id.slice(0, 8)}... → ${expSunnySplit!.trackId.slice(0, 8)}...`);
console.log(`    ${trackIdConsistent ? '✅ 全部一致，指向同一条记录' : '❌ 存在不一致'}`);

console.log('\n' + '═'.repeat(56));
if (allPass && trackIdConsistent) {
  console.log('  ✅ 公开演示入口跑通！业务样例完整闭环');
} else {
  console.log('  ❌ 演示未完全通过，请查看上方日志');
  process.exitCode = 1;
}
console.log('═'.repeat(56) + '\n');
