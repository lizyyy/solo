import express from 'express';
import cors from 'cors';
import path from 'path';
import { MidiControllerBackup } from './core';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const backup = new MidiControllerBackup();

app.get('/api/state', (req, res) => {
  res.json({
    workflow: backup.getWorkflowState(),
    tracks: backup.getTracks(),
    checkins: backup.getCheckins(),
    splits: backup.getSplits(),
    conflicts: backup.getConflicts(),
    history: backup.getHistory().slice(0, 20),
  });
});

app.post('/api/import/alias', (req, res) => {
  const result = backup.importTrackAliases(req.body);
  res.json(result);
});

app.post('/api/import/checkin', (req, res) => {
  const result = backup.importCheckinPhotos(req.body);
  res.json(result);
});

app.post('/api/conflict/:id/resolve', (req, res) => {
  const { resolution, operator } = req.body;
  const validResolutions: ('confirm' | 'reject' | 'update')[] = ['confirm', 'reject', 'update'];
  if (!validResolutions.includes(resolution)) {
    res.status(400).json({ success: false, error: '无效的决议类型' });
    return;
  }
  const success = backup.resolveConflict(req.params.id, resolution, operator || '录音师小段');
  res.json({ success });
});

app.post('/api/checkin/:id/verify', (req, res) => {
  const { operator } = req.body;
  const success = backup.verifySubstitute(req.params.id, operator || '票务同事');
  res.json({ success });
});

app.post('/api/split/calculate', (req, res) => {
  const splits = backup.calculateSplit(req.body?.operator || '录音师小段');
  res.json({ splits });
});

app.post('/api/split/:id/recalculate', (req, res) => {
  const { newFee, operator } = req.body;
  const split = backup.recalculateSplit(req.params.id, newFee, operator || '录音师小段');
  res.json({ split });
});

app.get('/api/selfcheck', (req, res) => {
  const results = backup.selfCheck();
  res.json({ results });
});

app.get('/api/export', (req, res) => {
  const data = backup.exportData();
  res.json(data);
});

app.post('/api/clear', (req, res) => {
  backup.clearAll();
  res.json({ success: true });
});

app.get('/api/sample/:type', (req, res) => {
  const type = req.params.type;
  let data: any;

  if (type === 'normal') {
    data = {
      alias: [
        { trackName: '夜曲', artist: '周杰伦', duration: 240, fee: 200, aliasNames: ['Nocturne'] },
        { trackName: '晴天', artist: '周杰伦', duration: 260, fee: 180, aliasNames: ['Sunny Day'] },
        { trackName: '稻香', artist: '周杰伦', duration: 220, fee: 150, aliasNames: ['Rice Field'] },
      ],
      checkin: [
        { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01' },
        { photoId: 'p2', trackName: '晴天', studentName: '小红', teacherName: '王老师', classDate: '2026-06-01' },
        { photoId: 'p3', trackName: '稻香', studentName: '小刚', teacherName: '李老师', classDate: '2026-06-02' },
      ],
    };
  } else if (type === 'conflict') {
    data = {
      alias: [
        { trackName: '夜曲', artist: '周杰伦', duration: 240, fee: 200, aliasNames: [] },
        { trackName: '晴天', artist: '周杰伦', duration: 260, fee: 180, aliasNames: [] },
      ],
      checkin: [
        { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01' },
        { photoId: 'p2', trackName: '七里香', studentName: '小红', teacherName: '王老师', classDate: '2026-06-01' },
        { photoId: 'p3', trackName: '晴天', studentName: '小刚', teacherName: '李老师', classDate: '2026-06-02', isSubstitute: true, substituteNote: '群里说小李替小王上课', source: 'wechat-group' },
      ],
    };
  } else {
    data = { alias: [], checkin: [] };
  }

  res.json(data);
});

app.post('/api/demo/run', (req, res) => {
  backup.clearAll();

  const step1 = backup.importTrackAliases([
    { trackName: '夜曲', artist: '周杰伦', fee: 200, aliasNames: ['Nocturne'] },
    { trackName: '晴天', artist: '周杰伦', fee: 180, aliasNames: ['Sunny Day'] },
  ]);

  const step2 = backup.importTrackAliases([
    { trackName: '晴天', artist: '周杰伦', fee: 220, aliasNames: ['Sunny Day'] },
    { trackName: '稻香', artist: '周杰伦', fee: 150, aliasNames: ['Rice Field'] },
  ]);

  const step3 = backup.importCheckinPhotos([
    { photoId: 'p1', trackName: '夜曲', studentName: '小明', teacherName: '李老师', classDate: '2026-06-01' },
    { photoId: 'p2', trackName: '晴天', studentName: '小红', teacherName: '王老师', classDate: '2026-06-01',
      isSubstitute: true, substituteNote: '群里说小李替小王上课', source: 'wechat-group' },
  ]);

  const dupConflict = step2.conflicts.find(c => c.type === 'duplicate-import');
  if (dupConflict) {
    backup.resolveConflict(dupConflict.id, 'update', '录音师小段');
  }

  const subCheckin = backup.getCheckins().find(c => c.isSubstitute && !c.verified);
  if (subCheckin) {
    backup.verifySubstitute(subCheckin.id, '票务同事');
  }

  backup.calculateSplit('录音师小段');

  const sunnySplit = backup.getSplits().find(s => s.trackName === '晴天');
  if (sunnySplit) {
    backup.recalculateSplit(sunnySplit.id, 250, '录音师小段');
  }

  const selfCheck = backup.selfCheck();
  const exportData = backup.exportData();
  const sunnyTrack = backup.getTracks().find(t => t.trackName === '晴天');
  const sunnySplitFinal = backup.getSplits().find(s => s.trackName === '晴天');
  const exportSunnyTrack = exportData.tracks.find(t => t.trackName === '晴天');
  const exportSunnySplit = exportData.splits.find(s => s.trackName === '晴天');

  const idConsistent =
    sunnyTrack!.id === exportSunnyTrack!.id
    && sunnySplitFinal!.trackId === sunnyTrack!.id
    && sunnySplitFinal!.id === exportSunnySplit!.id;

  res.json({
    steps: {
      step1_firstImport: { newRecords: step1.newRecords, batch: step1.batchNumber },
      step2_duplicateImport: { newRecords: step2.newRecords, duplicatesHistorical: step2.duplicatesHistorical, batch: step2.batchNumber },
      step3_checkinWithSubstitute: { newRecords: step3.newRecords },
      step4_supplementUpdate: { conflictId: dupConflict?.id, resolution: 'update' },
      step5_verifySubstitute: { checkinId: subCheckin?.id },
      step6_calculateSplit: { count: backup.getSplits().length },
      step7_recalculate: { sunnyFee: 250 },
    },
    selfCheck,
    sunnyTrace: {
      trackId: sunnyTrack!.id,
      trackFee: sunnyTrack!.fee,
      splitId: sunnySplitFinal!.id,
      splitTotalFee: sunnySplitFinal!.totalFee,
      splitVersion: sunnySplitFinal!.version,
      splitTrackId: sunnySplitFinal!.trackId,
      exportTrackId: exportSunnyTrack!.id,
      exportSplitId: exportSunnySplit!.id,
      idConsistent,
    },
    currentState: {
      workflow: backup.getWorkflowState(),
      tracks: backup.getTracks(),
      checkins: backup.getCheckins(),
      splits: backup.getSplits(),
      conflicts: backup.getConflicts(),
      history: backup.getHistory().slice(0, 20),
    },
  });
});

app.listen(port, () => {
  console.log(`MIDI控制器映射备份系统运行在 http://localhost:${port}`);
});
