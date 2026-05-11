const express = require('express');
const db = require('../db');
const router = express.Router();

router.post('/', (req, res) => {
  const { streamer_id, streamer_name, start_time, end_time } = req.body;
  
  if (!streamer_id || !streamer_name) {
    return res.status(400).json({ error: '主播ID和名称必填' });
  }

  const stmt = db.prepare(`
    INSERT INTO streams (streamer_id, streamer_name, start_time, end_time, status)
    VALUES (?, ?, ?, ?, 'active')
  `);
  const result = stmt.run(streamer_id, streamer_name, start_time || new Date().toISOString(), end_time);
  
  res.json({ id: result.lastInsertRowid, message: '直播场次创建成功' });
});

router.put('/:id/end', (req, res) => {
  const stmt = db.prepare(`
    UPDATE streams SET status = 'ended', end_time = CURRENT_TIMESTAMP WHERE id = ?
  `);
  stmt.run(req.params.id);
  res.json({ message: '直播已结束' });
});

router.get('/', (req, res) => {
  const streams = db.prepare('SELECT * FROM streams').all();
  res.json(streams);
});

router.get('/:id', (req, res) => {
  const stream = db.prepare('SELECT * FROM streams WHERE id = ?').get(req.params.id);
  if (!stream) return res.status(404).json({ error: '直播场次不存在' });
  res.json(stream);
});

module.exports = router;
