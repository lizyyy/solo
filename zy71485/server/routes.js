const express = require('express');
const router = express.Router();
const { getDB } = require('./database');
const { validateISRC, collectAuthors, comparePlatformVersions, detectIssues } = require('./validation');
const xlsx = require('xlsx');

router.get('/batches', async (req, res) => {
  const db = getDB();
  const batches = await db.all(`
    SELECT b.*, 
      COUNT(t.id) as total_tracks,
      SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN t.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM batches b
    LEFT JOIN tracks t ON b.id = t.batch_id
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `);
  res.json(batches);
});

router.post('/batches', async (req, res) => {
  const db = getDB();
  const { name, source } = req.body;
  
  const result = await db.run(
    'INSERT INTO batches (name, source) VALUES (?, ?)',
    [name, source || 'manual']
  );
  
  res.json({ id: result.lastID, name, source });
});

router.get('/batches/:id', async (req, res) => {
  const db = getDB();
  const batch = await db.get('SELECT * FROM batches WHERE id = ?', [req.params.id]);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  
  const tracks = await db.all(
    'SELECT * FROM tracks WHERE batch_id = ? ORDER BY source_row, id',
    [req.params.id]
  );
  res.json({ ...batch, tracks });
});

router.delete('/batches/:id', async (req, res) => {
  const db = getDB();
  const batchId = req.params.id;
  
  await db.run('DELETE FROM operation_logs WHERE batch_id = ?', [batchId]);
  await db.run('DELETE FROM tracks WHERE batch_id = ?', [batchId]);
  await db.run('DELETE FROM batches WHERE id = ?', [batchId]);
  
  res.json({ success: true });
});

router.post('/batches/:id/import', async (req, res) => {
  const db = getDB();
  const batchId = req.params.id;
  const { tracks } = req.body;
  
  const importedTracks = [];
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const issues = detectIssues(track, tracks, null);
    
    const result = await db.run(
      `INSERT INTO tracks (batch_id, isrc, track_name, artist, lyricist, composer, platform_version, duration, source_row, issues)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        track.isrc || '',
        track.track_name || '',
        track.artist || '',
        track.lyricist || '',
        track.composer || '',
        track.platform_version || '',
        track.duration || '',
        i + 1,
        JSON.stringify(issues)
      ]
    );
    
    await db.run(
      `INSERT INTO operation_logs (track_id, batch_id, operation, new_value)
       VALUES (?, ?, 'import', ?)`,
      [result.lastID, batchId, track.track_name]
    );
    
    importedTracks.push({ id: result.lastID, ...track, issues });
  }
  
  await db.run('UPDATE batches SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [batchId]);
  
  res.json({ success: true, tracks: importedTracks });
});

router.get('/tracks/:id', async (req, res) => {
  const db = getDB();
  const track = await db.get('SELECT * FROM tracks WHERE id = ?', [req.params.id]);
  if (!track) return res.status(404).json({ error: 'Track not found' });
  
  const logs = await db.all(
    `SELECT * FROM operation_logs 
     WHERE track_id = ? 
     ORDER BY created_at DESC`,
    [req.params.id]
  );
  
  res.json({ ...track, logs });
});

router.put('/tracks/:id', async (req, res) => {
  const db = getDB();
  const trackId = req.params.id;
  const updates = req.body;
  
  const oldTrack = await db.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
  if (!oldTrack) return res.status(404).json({ error: 'Track not found' });
  
  const fields = ['isrc', 'track_name', 'artist', 'lyricist', 'composer', 'platform_version', 'duration', 'status', 'notes'];
  
  for (const field of fields) {
    if (updates[field] !== undefined && updates[field] !== oldTrack[field]) {
      await db.run(
        `INSERT INTO operation_logs (track_id, batch_id, operation, field_name, old_value, new_value)
         VALUES (?, ?, 'update', ?, ?, ?)`,
        [trackId, oldTrack.batch_id, field, oldTrack[field], updates[field]]
      );
    }
  }
  
  const allTracks = await db.all('SELECT * FROM tracks WHERE batch_id = ?', [oldTrack.batch_id]);
  const issues = detectIssues({ ...oldTrack, ...updates }, allTracks, null);
  
  const setClauses = fields.filter(f => updates[f] !== undefined).map(f => `${f} = ?`).join(', ');
  const values = fields.filter(f => updates[f] !== undefined).map(f => updates[f]);
  values.push(JSON.stringify(issues));
  values.push(trackId);
  
  await db.run(`UPDATE tracks SET ${setClauses}, issues = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
  
  await db.run('UPDATE batches SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [oldTrack.batch_id]);
  
  const updatedTrack = await db.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
  res.json(updatedTrack);
});

router.get('/tracks/:id/logs', async (req, res) => {
  const db = getDB();
  const logs = await db.all(
    `SELECT * FROM operation_logs 
     WHERE track_id = ? 
     ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json(logs);
});

router.post('/validate/isrc', (req, res) => {
  const { isrc } = req.body;
  const result = validateISRC(isrc, null);
  res.json(result);
});

router.post('/validate/authors', (req, res) => {
  const { lyricist, composer } = req.body;
  const result = collectAuthors(lyricist, composer);
  res.json(result);
});

router.post('/validate/platform', (req, res) => {
  const { versions } = req.body;
  const result = comparePlatformVersions(versions);
  res.json(result);
});

router.get('/export/batch/:id', async (req, res) => {
  const db = getDB();
  const batchId = req.params.id;
  
  const batch = await db.get('SELECT * FROM batches WHERE id = ?', [batchId]);
  const tracks = await db.all('SELECT * FROM tracks WHERE batch_id = ? ORDER BY id', [batchId]);
  
  const exportData = tracks.map(t => ({
    ISRC: t.isrc,
    曲目名称: t.track_name,
    演唱者: t.artist,
    词作者: t.lyricist,
    曲作者: t.composer,
    平台版本: t.platform_version,
    时长: t.duration,
    状态: t.status === 'confirmed' ? '已确认' : t.status === 'rejected' ? '已驳回' : '待处理',
    问题: t.issues
  }));
  
  const ws = xlsx.utils.json_to_sheet(exportData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'ISRC核对结果');
  
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="ISRC核对_${batch.name}_${Date.now()}.xlsx"`);
  res.send(buffer);
});

router.post('/samples', async (req, res) => {
  const db = getDB();
  
  const batchResult = await db.run(
    `INSERT INTO batches (name, source) VALUES (?, ?)`,
    ['样例数据-包含常见问题', 'sample']
  );
  
  const batchId = batchResult.lastID;
  
  const sampleTracks = [
    {
      isrc: 'CN-A23-24-00001',
      track_name: '春天的故事',
      artist: '张三',
      lyricist: '王五',
      composer: '赵六',
      platform_version: '正式版',
      duration: '3:45'
    },
    {
      isrc: 'CN-A23-24-00001',
      track_name: '春天的故事(remix)',
      artist: '张三',
      lyricist: '王五',
      composer: '赵六',
      platform_version: 'Remix版',
      duration: '4:20'
    },
    {
      isrc: 'CN-A23-24-00002',
      track_name: '夏日晚风',
      artist: '李四',
      lyricist: '',
      composer: '钱七',
      platform_version: '伴奏版',
      duration: '3:30'
    },
    {
      isrc: 'CN-A23-24-00003',
      track_name: '秋日私语',
      artist: '王五',
      lyricist: '孙八',
      composer: '孙八',
      platform_version: '电台版|正式版',
      duration: '4:10'
    },
    {
      isrc: 'INVALID-ISRC',
      track_name: '冬日暖阳',
      artist: '赵六',
      lyricist: '周九',
      composer: '吴十',
      platform_version: '正式版',
      duration: '3:55'
    },
    {
      isrc: 'CN-A23-24-00004',
      track_name: '星空下的约定',
      artist: '群星',
      lyricist: '郑十一;王十二',
      composer: '冯十三;陈十四;褚十五',
      platform_version: '合唱版',
      duration: '5:00'
    }
  ];
  
  for (let i = 0; i < sampleTracks.length; i++) {
    const track = sampleTracks[i];
    const issues = detectIssues(track, sampleTracks, null);
    await db.run(
      `INSERT INTO tracks (batch_id, isrc, track_name, artist, lyricist, composer, platform_version, duration, source_row, issues)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        track.isrc,
        track.track_name,
        track.artist,
        track.lyricist,
        track.composer,
        track.platform_version,
        track.duration,
        i + 1,
        JSON.stringify(issues)
      ]
    );
  }
  
  res.json({ success: true, batchId });
});

module.exports = router;
