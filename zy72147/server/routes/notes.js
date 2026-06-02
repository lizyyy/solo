const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

router.post('/track/:trackId', (req, res) => {
  const db = getDB();
  const { trackId } = req.params;
  const { content, author } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '备注内容不能为空' });
  }
  
  db.get(`SELECT id, batch_id, file_id FROM tracks WHERE id = ?`, [trackId], (err, track) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!track) return res.status(404).json({ error: '曲目不存在' });
    
    db.run(`INSERT INTO notes (track_id, file_id, batch_id, content, author)
      VALUES (?, ?, ?, ?, ?)`,
      [trackId, track.file_id, track.batch_id, content.trim(), author || '小温'],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        
        db.get(`SELECT * FROM notes WHERE id = ?`, [this.lastID], (err3, note) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ success: true, note });
        });
      }
    );
  });
});

router.put('/:noteId', (req, res) => {
  const db = getDB();
  const { noteId } = req.params;
  const { content } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '备注内容不能为空' });
  }
  
  db.run(`UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [content.trim(), noteId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(`SELECT * FROM notes WHERE id = ?`, [noteId], (err2, note) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true, note });
      });
    }
  );
});

router.delete('/:noteId', (req, res) => {
  const db = getDB();
  const { noteId } = req.params;
  
  db.run(`DELETE FROM notes WHERE id = ?`, [noteId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
