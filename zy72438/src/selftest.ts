import { MidiControllerBackup } from './core';

function runNormalCase() {
  console.log('\n=== 场景一：正常材料 ===\n');
  const app = new MidiControllerBackup();

  const aliasResult = app.importTrackAliases([
    { trackName: '夜曲', artist: '周杰伦', duration: 240, fee: 200, aliasNames: ['Nocturne'] },
    { trackName: '晴天', artist: '周杰伦', duration: 260, fee: 180, aliasNames: ['Sunny Day'] },
    { trackName: '稻香', artist: '周杰伦', duration: 220, fee: 150, aliasNames: ['Rice Field'] },
  ]);
  console.log('曲目别名表导入:', aliasResult);

  const checkinResult = app.importCheckinPhotos([
    { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01', source: 'official-system' },
    { photoId: 'p2', trackName: '晴天', studentName: '小红', teacherName: '王老师', classDate: '2026-06-01', source: 'official-system' },
    { photoId: 'p3', trackName: '稻香', studentName: '小刚', teacherName: '李老师', classDate: '2026-06-02', source: 'official-system' },
  ]);
  console.log('签到照片导入:', checkinResult);

  app.calculateSplit('录音师小段');
  console.log('分账明细:', app.getSplits());

  const checks = app.selfCheck();
  console.log('自检结果:');
  checks.forEach((c) => console.log(`  ${c.name}: ${c.passed ? '✅ 通过' : '❌ 未通过'} - ${c.message}`));

  return app;
}

function runWrong口径Case() {
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
  console.log('冲突列表:');
  app.getConflicts().forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.severity}] ${c.message}`);
    console.log(`     证据:`, JSON.stringify(c.evidence));
  });

  const checks = app.selfCheck();
  console.log('\n自检结果:');
  checks.forEach((c) => console.log(`  ${c.name}: ${c.passed ? '✅ 通过' : '❌ 未通过'} - ${c.message}`));

  return app;
}

function run补录Case() {
  console.log('\n=== 场景三：补录材料 ===\n');
  const app = new MidiControllerBackup();

  app.importTrackAliases([
    { trackName: '夜曲', artist: '周杰伦', duration: 240, fee: 200, aliasNames: [] },
  ]);

  app.importCheckinPhotos([
    { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01' },
  ]);

  app.calculateSplit('录音师小段');
  console.log('初始分账:', app.getSplits().map((s) => `${s.studentName}: ${s.totalFee}元`));

  console.log('\n补录：夜曲费用从200调整为250');
  const split = app.getSplits()[0];
  if (split) {
    app.recalculateSplit(split.id, 250, '录音师小段');
  }

  console.log('重算后分账:', app.getSplits().map((s) => `${s.studentName}: ${s.totalFee}元 (v${s.version})`));
  console.log('历史记录:');
  app.getHistory().forEach((h) => {
    console.log(`  [${new Date(h.time).toLocaleTimeString()}] ${h.operator}: ${h.detail}`);
  });

  const checks = app.selfCheck();
  console.log('\n自检结果:');
  checks.forEach((c) => console.log(`  ${c.name}: ${c.passed ? '✅ 通过' : '❌ 未通过'} - ${c.message}`));

  return app;
}

console.log('='.repeat(60));
console.log('MIDI控制器映射备份 - 三场景跑测');
console.log('='.repeat(60));

runNormalCase();
runWrong口径Case();
run补录Case();

console.log('\n' + '='.repeat(60));
console.log('所有场景跑测完成！');
console.log('='.repeat(60));
