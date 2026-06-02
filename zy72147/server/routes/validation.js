const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

router.get('/batch/:batchId', (req, res) => {
  const db = getDB();
  const { batchId } = req.params;
  
  db.all(`SELECT t.*, 
    f.original_name as file_name,
    GROUP_CONCAT(DISTINCT a.anomaly_type) as anomaly_types,
    GROUP_CONCAT(DISTINCT a.description) as anomaly_descriptions
    FROM tracks t
    LEFT JOIN files f ON t.file_id = f.id
    LEFT JOIN anomalies a ON t.id = a.track_id
    WHERE t.batch_id = ?
    GROUP BY t.id
    ORDER BY t.track_number, t.id`,
    [batchId],
    (err, tracks) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all(`SELECT a.*, t.track_name, f.original_name as file_name
        FROM anomalies a
        LEFT JOIN tracks t ON a.track_id = t.id
        LEFT JOIN files f ON a.file_id = f.id
        WHERE a.batch_id = ?
        ORDER BY a.created_at DESC`,
        [batchId],
        (err2, anomalies) => {
          if (err2) return res.status(500).json({ error: err2.message });
          
          db.all(`SELECT n.*, t.track_name
            FROM notes n
            LEFT JOIN tracks t ON n.track_id = t.id
            WHERE n.batch_id = ?
            ORDER BY n.created_at DESC`,
            [batchId],
            (err3, notes) => {
              if (err3) return res.status(500).json({ error: err3.message });
              
              res.json({ tracks, anomalies, notes });
            }
          );
        }
      );
    }
  );
});

router.get('/track/:trackId', (req, res) => {
  const db = getDB();
  const { trackId } = req.params;
  
  db.get(`SELECT t.*, f.original_name as file_name
    FROM tracks t
    LEFT JOIN files f ON t.file_id = f.id
    WHERE t.id = ?`,
    [trackId],
    (err, track) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all(`SELECT * FROM anomalies WHERE track_id = ? ORDER BY created_at DESC`,
        [trackId],
        (err2, anomalies) => {
          if (err2) return res.status(500).json({ error: err2.message });
          
          db.all(`SELECT * FROM notes WHERE track_id = ? ORDER BY created_at DESC`,
            [trackId],
            (err3, notes) => {
              if (err3) return res.status(500).json({ error: err3.message });
              
              res.json({ track, anomalies, notes });
            }
          );
        }
      );
    }
  );
});

router.post('/track/:trackId/validate', (req, res) => {
  const db = getDB();
  const { trackId } = req.params;
  const { status, note } = req.body;
  
  db.run(`UPDATE tracks SET validation_status = ? WHERE id = ?`,
    [status || 'reviewed', trackId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      if (note) {
        db.run(`INSERT INTO notes (track_id, batch_id, content, author)
          SELECT ?, batch_id, ?, ? FROM tracks WHERE id = ?`,
          [trackId, note, '小温', trackId]);
      }
      
      res.json({ success: true, message: '状态已更新' });
    }
  );
});

router.post('/anomaly/:anomalyId/resolve', (req, res) => {
  const db = getDB();
  const { anomalyId } = req.params;
  const { resolved, resolution } = req.body;
  
  db.run(`UPDATE anomalies SET resolved = ? WHERE id = ?`,
    [resolved ? 1 : 0, anomalyId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

router.get('/batch/:batchId/summary', (req, res) => {
  const db = getDB();
  const { batchId } = req.params;
  
  db.get(`SELECT 
    COUNT(*) as total_tracks,
    SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_tracks,
    SUM(CASE WHEN is_valid = 0 THEN 1 ELSE 0 END) as invalid_tracks,
    SUM(CASE WHEN validation_status = 'passed' THEN 1 ELSE 0 END) as passed_tracks,
    SUM(CASE WHEN validation_status = 'warning' THEN 1 ELSE 0 END) as warning_tracks,
    SUM(CASE WHEN validation_status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_tracks
    FROM tracks WHERE batch_id = ?`,
    [batchId],
    (err, trackStats) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all(`SELECT anomaly_type, COUNT(*) as count, severity
        FROM anomalies WHERE batch_id = ?
        GROUP BY anomaly_type, severity
        ORDER BY count DESC`,
        [batchId],
        (err2, anomalyStats) => {
          if (err2) return res.status(500).json({ error: err2.message });
          
          res.json({ trackStats, anomalyStats });
        }
      );
    }
  );
});

router.post('/compare', (req, res) => {
  const db = getDB();
  const { trackId, fieldName, sourceA, valueA, sourceB, valueB, suggestion } = req.body;
  
  db.get(`SELECT * FROM tracks WHERE id = ?`, [trackId], (err, track) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(`INSERT INTO conflicts 
      (track_id, file_id, batch_id, source_a, value_a, source_b, value_b, field_name, suggestion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trackId, track.file_id, track.batch_id, sourceA, valueA, sourceB, valueB, fieldName, suggestion],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true, conflictId: this.lastID });
      }
    );
  });
});

router.get('/batch/:batchId/conflicts', (req, res) => {
  const db = getDB();
  const { batchId } = req.params;
  
  db.all(`SELECT c.*, t.track_name
    FROM conflicts c
    LEFT JOIN tracks t ON c.track_id = t.id
    WHERE c.batch_id = ?
    ORDER BY c.created_at DESC`,
    [batchId],
    (err, conflicts) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(conflicts);
    }
  );
});

router.post('/conflict/:conflictId/resolve', (req, res) => {
  const db = getDB();
  const { conflictId } = req.params;
  const { resolution } = req.body;
  
  db.run(`UPDATE conflicts SET resolved = 1, resolution = ? WHERE id = ?`,
    [resolution, conflictId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

module.exports = router;
