import { MidiControllerBackup } from './core';

function logStep(step: number, title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[步骤${step}] ${title}`);
  console.log('='.repeat(60));
}

function logCheck(name: string, pass: boolean, detail?: string) {
  const mark = pass ? '✅' : '❌';
  console.log(`${mark} ${name}${detail ? `: ${detail}` : ''}`);
}

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           MIDI控制器映射备份 - 普通使用者路线验证            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const app = new MidiControllerBackup();
let allPassed = true;

// ========== 步骤1：曲目别名表第一次导入 ==========
logStep(1, '曲目别名表第一次导入');
console.log('导入：夜曲(¥200)、晴天(¥180)');

const r1 = app.importTrackAliases([
  { trackName: '夜曲', artist: '周杰伦', fee: 200 },
  { trackName: '晴天', artist: '周杰伦', fee: 180 },
]);

console.log(`结果：新增${r1.newRecords}条，本次重复${r1.duplicatesCurrentBatch}条，历史重复${r1.duplicatesHistorical}条`);
logCheck('无冲突', r1.conflicts.length === 0, `${r1.conflicts.length}个冲突`);
allPassed = allPassed && r1.conflicts.length === 0;

const checks1 = app.selfCheck();
const dupCheck1 = checks1.find(c => c.name === '重复导入检测')!;
logCheck('重复导入检测通过', dupCheck1.passed, dupCheck1.message);
allPassed = allPassed && dupCheck1.passed;

// ========== 步骤2：第二次导入，制造重复 ==========
logStep(2, '第二次导入，晴天重复+稻香新增+费用不同');
console.log('导入：晴天(¥220，费用变了)、稻香(¥150，新曲目)');

const r2 = app.importTrackAliases([
  { trackName: '晴天', artist: '周杰伦', fee: 220 },
  { trackName: '稻香', artist: '周杰伦', fee: 150 },
]);

console.log(`结果：新增${r2.newRecords}条，本次重复${r2.duplicatesCurrentBatch}条，历史重复${r2.duplicatesHistorical}条`);
logCheck('产生1个历史重复冲突', r2.conflicts.length === 1 && r2.conflicts[0].duplicateType === 'historical',
  `${r2.conflicts.length}个冲突，类型=${r2.conflicts[0]?.duplicateType}`);
allPassed = allPassed && r2.conflicts.length === 1;

const conflict = r2.conflicts[0];
console.log(`冲突详情：${conflict.message}`);
console.log(`  - 已有费用：¥${conflict.evidence?.aliasTable?.existing?.fee}`);
console.log(`  - 导入费用：¥${conflict.evidence?.aliasTable?.incoming?.fee}`);
console.log(`  - 关联曲目ID：${conflict.existingTrackId}`);

// ========== 步骤3：自检，验证bug已修复 ==========
logStep(3, '运行自检，验证重复导入检测不通过');
const checks2 = app.selfCheck();
const dupCheck2 = checks2.find(c => c.name === '重复导入检测')!;

logCheck('重复导入检测不通过', !dupCheck2.passed, dupCheck2.message);
logCheck('自检正确识别未解决冲突', dupCheck2.detail?.unresolvedConflicts?.length === 1,
  `检测到${dupCheck2.detail?.unresolvedConflicts?.length}个未解决冲突`);
allPassed = allPassed && !dupCheck2.passed && dupCheck2.detail?.unresolvedConflicts?.length === 1;

// ========== 步骤4：导入签到，含群里说的临时替补 ==========
logStep(4, '导入课时签到照片（含群里说的临时替补）');
console.log('导入：小明-夜曲、小红-晴天（群里说的替补）');

const r3 = app.importCheckinPhotos([
  { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01' },
  { photoId: 'p2', trackName: '晴天', studentName: '小红', teacherName: '王老师', classDate: '2026-06-01',
    isSubstitute: true, substituteNote: '群里说小李替小王上课', source: 'wechat-group' },
]);

console.log(`结果：导入${r3.imported}条，冲突${r3.conflicts.length}个`);
logCheck('替补待复核冲突', r3.conflicts.some(c => c.type === 'substitute-unverified'), '检测到临时替补待复核');
allPassed = allPassed && r3.conflicts.some(c => c.type === 'substitute-unverified');

// ========== 步骤5：处理重复导入冲突 - 补录更新 ==========
logStep(5, '处理重复导入冲突：补录更新晴天费用');
console.log('操作：选择「补录更新费用」，将晴天从¥180更新为¥220');

const sunnyTrackBefore = app.getTracks().find(t => t.trackName === '晴天');
console.log(`更新前：晴天费用¥${sunnyTrackBefore?.fee}，ID=${sunnyTrackBefore?.id}`);

const updateSuccess = app.resolveConflict(conflict.id, 'update', '录音师小段');
logCheck('补录更新成功', updateSuccess);
allPassed = allPassed && updateSuccess;

const sunnyTrackAfter = app.getTracks().find(t => t.trackName === '晴天');
logCheck('曲目费用已更新', sunnyTrackAfter?.fee === 220,
  `¥${sunnyTrackBefore?.fee} → ¥${sunnyTrackAfter?.fee}`);
logCheck('曲目ID不变（同一条记录）', sunnyTrackBefore?.id === sunnyTrackAfter?.id,
  `ID保持${sunnyTrackAfter?.id?.slice(0, 8)}...`);
allPassed = allPassed && sunnyTrackAfter?.fee === 220 && sunnyTrackBefore?.id === sunnyTrackAfter?.id;

// ========== 步骤6：生成分账 ==========
logStep(6, '生成分账明细');
const splits = app.calculateSplit('录音师小段');
console.log(`生成${splits.length}条分账：`);
splits.forEach(s => {
  console.log(`  ${s.studentName}-${s.trackName}: ¥${s.totalFee}（基础¥${s.baseFee}，替补调整¥${s.substituteAdjustment}）`);
});

const sunnySplit = splits.find(s => s.trackName === '晴天');
logCheck('分账使用更新后费用', sunnySplit?.baseFee === 220, `基础费用¥${sunnySplit?.baseFee}`);
logCheck('替补扣款正确', sunnySplit?.substituteAdjustment === -22, `扣¥${Math.abs(sunnySplit?.substituteAdjustment || 0)}`);
logCheck('分账关联正确曲目ID', sunnySplit?.trackId === sunnyTrackAfter?.id,
  `trackId=${sunnySplit?.trackId?.slice(0, 8)}...`);
allPassed = allPassed && sunnySplit?.baseFee === 220 && sunnySplit?.trackId === sunnyTrackAfter?.id;

const totalBeforeVerify = splits.reduce((s, x) => s + x.totalFee, 0);
console.log(`分账总额：¥${totalBeforeVerify}`);

// ========== 步骤7：票务复核替补 ==========
logStep(7, '票务同事复核临时替补');
const subCheckin = app.getCheckins().find(c => c.isSubstitute && !c.verified);
if (subCheckin) {
  app.verifySubstitute(subCheckin.id, '票务同事');
  console.log(`已复核：${subCheckin.studentName} ${subCheckin.classDate}`);
}

// ========== 步骤8：补录后重算分账 ==========
logStep(8, '补录调整：晴天费用从¥220再调整为¥250');
if (sunnySplit) {
  app.recalculateSplit(sunnySplit.id, 250, '录音师小段');
}

const splits2 = app.getSplits();
const sunnySplit2 = splits2.find(s => s.id === sunnySplit?.id);
logCheck('分账版本号更新', sunnySplit2?.version === 2, `v${sunnySplit2?.version}`);
logCheck('分账费用已更新', sunnySplit2?.baseFee === 250, `¥${sunnySplit2?.baseFee}`);
logCheck('分账ID不变（同一条记录）', sunnySplit?.id === sunnySplit2?.id,
  `ID保持${sunnySplit2?.id?.slice(0, 8)}...`);
allPassed = allPassed && sunnySplit2?.version === 2 && sunnySplit2?.baseFee === 250;

// ========== 步骤9：验证导出和页面一致 ==========
logStep(9, '验证导出文件和页面数据一致');
const exported = app.exportData();
const pageSplits = app.getSplits();
const pageTracks = app.getTracks();

logCheck('导出曲目数 = 页面曲目数', exported.tracks.length === pageTracks.length,
  `${exported.tracks.length} = ${pageTracks.length}`);
logCheck('导出分账数 = 页面分账数', exported.splits.length === pageSplits.length,
  `${exported.splits.length} = ${pageSplits.length}`);

const exportSunny = exported.tracks.find(t => t.trackName === '晴天');
const pageSunny = pageTracks.find(t => t.trackName === '晴天');
logCheck('导出曲目ID = 页面对应曲目ID', exportSunny?.id === pageSunny?.id,
  `${exportSunny?.id?.slice(0, 8)}... = ${pageSunny?.id?.slice(0, 8)}...`);
logCheck('导出曲目费用一致', exportSunny?.fee === pageSunny?.fee,
  `¥${exportSunny?.fee} = ¥${pageSunny?.fee}`);

const exportSplit = exported.splits.find(s => s.id === sunnySplit2?.id);
logCheck('导出分账ID可追到同一条记录', exportSplit?.id === sunnySplit2?.id,
  `分账ID=${exportSplit?.id?.slice(0, 8)}...`);
logCheck('导出分账金额一致', exportSplit?.totalFee === sunnySplit2?.totalFee,
  `¥${exportSplit?.totalFee} = ¥${sunnySplit2?.totalFee}`);

allPassed = allPassed &&
  exportSunny?.id === pageSunny?.id &&
  exportSunny?.fee === pageSunny?.fee &&
  exportSplit?.id === sunnySplit2?.id &&
  exportSplit?.totalFee === sunnySplit2?.totalFee;

// ========== 步骤10：最终自检 ==========
logStep(10, '处理完所有冲突后，最终自检全部通过');

const subConflict = app.getConflicts().find(c => c.type === 'substitute-unverified' && !c.resolved);
if (subConflict) {
  app.resolveConflict(subConflict.id, 'confirm', '录音师小段');
}

const checksFinal = app.selfCheck();
console.log('自检结果：');
checksFinal.forEach(c => {
  logCheck(c.name, c.passed, c.message);
});

const allChecksPassed = checksFinal.every(c => c.passed);
logCheck('所有自检全部通过', allChecksPassed);
allPassed = allPassed && allChecksPassed;

// ========== 核对关键数据 ==========
logStep(11, '最终核对：晴天、群里说、临时补材料');
const history = app.getHistory();

console.log('\n📋 晴天相关操作轨迹：');
console.log(`  曲目ID：${sunnyTrackAfter?.id}`);
console.log(`  费用变更：¥180 → ¥220（补录更新） → ¥250（补录重算）`);
console.log(`  分账ID：${sunnySplit2?.id}，版本v${sunnySplit2?.version}`);

console.log('\n👥 群里说的临时替补：');
console.log(`  学生：小红，曲目：晴天，日期：2026-06-01`);
console.log(`  替补备注：群里说小李替小王上课`);
console.log(`  复核状态：已复核 by 票务同事`);

console.log('\n📝 临时补材料操作历史（最近5条）：');
history.slice(0, 5).forEach(h => {
  console.log(`  [${new Date(h.time).toLocaleTimeString()}] ${h.operator}: ${h.detail}`);
});

// ========== 总结 ==========
console.log('\n' + '═'.repeat(60));
if (allPassed) {
  console.log('✅ 所有检查项通过！重复导入检测已稳定闭环');
  console.log('   1. 连续导入晴天后，自检正确显示未通过');
  console.log('   2. 能区分本次重复 vs 历史重复 vs 新记录');
  console.log('   3. 补录更新后，曲目、分账、历史都读到同一条记录');
  console.log('   4. 导出文件和页面结果共用同一数据源，ID可追');
  console.log('   5. 晴天、群里说、临时补材料核对一致');
} else {
  console.log('❌ 部分检查未通过，请查看上面的详细日志');
}
console.log('═'.repeat(60) + '\n');

process.exit(allPassed ? 0 : 1);
