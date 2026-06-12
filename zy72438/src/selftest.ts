import { MidiControllerBackup } from './core';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.log(`  ❌ 失败: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ ${msg}`);
  }
}

function runNormalCase() {
  console.log('\n=== 场景一：正常材料 ===\n');
  const app = new MidiControllerBackup();

  const aliasResult = app.importTrackAliases([
    { trackName: '夜曲', artist: '周杰伦', duration: 240, fee: 200, aliasNames: ['Nocturne'] },
    { trackName: '晴天', artist: '周杰伦', duration: 260, fee: 180, aliasNames: ['Sunny Day'] },
    { trackName: '稻香', artist: '周杰伦', duration: 220, fee: 150, aliasNames: ['Rice Field'] },
  ]);
  assert(aliasResult.newRecords === 3, `新增3条，实际${aliasResult.newRecords}`);
  assert(aliasResult.duplicates === 0, `无重复，实际${aliasResult.duplicates}`);

  const checkinResult = app.importCheckinPhotos([
    { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01', source: 'official-system' },
    { photoId: 'p2', trackName: '晴天', studentName: '小红', teacherName: '王老师', classDate: '2026-06-01', source: 'official-system' },
    { photoId: 'p3', trackName: '稻香', studentName: '小刚', teacherName: '李老师', classDate: '2026-06-02', source: 'official-system' },
  ]);
  assert(checkinResult.newRecords === 3, `签到新增3条，实际${checkinResult.newRecords}`);

  app.calculateSplit('录音师小段');
  assert(app.getSplits().length === 3, `分账3条`);

  const checks = app.selfCheck();
  checks.forEach((c) => assert(c.passed, `${c.name}: ${c.message}`));
}

function runConflictCase() {
  console.log('\n=== 场景二：错口径材料 ===\n');
  const app = new MidiControllerBackup();

  app.importTrackAliases([
    { trackName: '夜曲', artist: '周杰伦', duration: 240, fee: 200, aliasNames: [] },
    { trackName: '晴天', artist: '周杰伦', duration: 260, fee: 180, aliasNames: [] },
  ]);

  const checkinResult = app.importCheckinPhotos([
    { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01' },
    { photoId: 'p2', trackName: '七里香', studentName: '小红', teacherName: '王老师', classDate: '2026-06-01' },
    { photoId: 'p3', trackName: '晴天', studentName: '小刚', teacherName: '李老师', classDate: '2026-06-02', isSubstitute: true, substituteNote: '群里说小李替小王上课', source: 'wechat-group' },
  ]);

  const conflicts = app.getConflicts();
  const trackMismatch = conflicts.find(c => c.type === 'track-mismatch');
  const subUnverified = conflicts.find(c => c.type === 'substitute-unverified');
  assert(!!trackMismatch, '检测到曲目不匹配冲突');
  assert(!!subUnverified, '检测到替补未复核冲突');

  const dupCheck = app.selfCheck().find(c => c.name === '重复导入检测')!;
  assert(dupCheck.passed, '无重复导入');

  const subCheck = app.selfCheck().find(c => c.name === '临时替补复核检查')!;
  assert(!subCheck.passed, '替补未复核，自检不通过');
}

function runDuplicateCase() {
  console.log('\n=== 场景三：重复导入+补录 ===\n');
  const app = new MidiControllerBackup();

  const r1 = app.importTrackAliases([
    { trackName: '夜曲', artist: '周杰伦', fee: 200 },
    { trackName: '晴天', artist: '周杰伦', fee: 180 },
  ]);
  assert(r1.newRecords === 2, `第一批新增2条`);

  const r2 = app.importTrackAliases([
    { trackName: '晴天', artist: '周杰伦', fee: 220 },
    { trackName: '稻香', artist: '周杰伦', fee: 150 },
  ]);
  assert(r2.duplicatesHistorical === 1, `历史重复1条`);
  assert(r2.newRecords === 1, `第二批新增1条`);

  const dupConflict = app.getConflicts().find(c => c.type === 'duplicate-import');
  assert(!!dupConflict, '有重复导入冲突');
  assert(dupConflict!.duplicateType === 'historical', '类型为历史重复');
  assert(dupConflict!.existingTrackId !== undefined, '关联已有曲目ID');

  const dupCheck1 = app.selfCheck().find(c => c.name === '重复导入检测')!;
  assert(!dupCheck1.passed, '未解决冲突时，自检不通过');

  app.resolveConflict(dupConflict!.id, 'update', '录音师小段');
  const track = app.getTracks().find(t => t.trackName === '晴天');
  assert(track!.fee === 220, `补录后费用¥220，实际¥${track!.fee}`);

  const dupCheck2 = app.selfCheck().find(c => c.name === '重复导入检测')!;
  assert(dupCheck2.passed, '解决冲突后，自检通过');
}

function run补录Case() {
  console.log('\n=== 场景四：补录重算 ===\n');
  const app = new MidiControllerBackup();

  app.importTrackAliases([
    { trackName: '夜曲', artist: '周杰伦', duration: 240, fee: 200 },
  ]);

  app.importCheckinPhotos([
    { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01' },
  ]);

  app.calculateSplit('录音师小段');
  const split = app.getSplits()[0];
  assert(split.totalFee === 200, `初始费用¥200`);

  app.recalculateSplit(split.id, 250, '录音师小段');
  const updated = app.getSplits()[0];
  assert(updated.totalFee === 250, `补录后¥250`);
  assert(updated.version === 2, `版本v2`);

  const exported = app.exportData();
  const exportSplit = exported.splits.find(s => s.id === split.id);
  assert(exportSplit!.totalFee === updated.totalFee, `导出与页面一致¥${updated.totalFee}`);
}

console.log('='.repeat(60));
console.log('MIDI控制器映射备份 - 四场景自检');
console.log('='.repeat(60));

runNormalCase();
runConflictCase();
runDuplicateCase();
run补录Case();

console.log('\n' + '='.repeat(60));
if (process.exitCode !== 1) {
  console.log('✅ 所有场景自检通过！');
} else {
  console.log('❌ 部分场景未通过，请查看上方日志');
}
console.log('='.repeat(60));
