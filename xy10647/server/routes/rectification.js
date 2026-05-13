const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { generateId, addTimeline, addModificationHistory, idempotentMiddleware, formatDate } = require('../utils');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'rectification-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.get('/', (req, res) => {
  const { problem_id, rectifier } = req.query;
  let query = `SELECT * FROM rectifications WHERE 1=1`;
  const params = [];
  
  if (problem_id) {
    query += ` AND problem_id = ?`;
    params.push(problem_id);
  }
  if (rectifier) {
    query += ` AND rectifier = ?`;
    params.push(rectifier);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.get('/:id', (req, res) => {
  db.get(`SELECT * FROM rectifications WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '整改记录不存在' });
    } else {
      res.json(row);
    }
  });
});

router.post('/', upload.single('photo'), idempotentMiddleware, (req, res) => {
  const { problem_id, description, rectifier, rectifier_phone, operator } = req.body;
  const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
  const id = generateId();
  const completedAt = formatDate();
  
  db.get(`SELECT * FROM problems WHERE id = ?`, [problem_id], async (err, problem) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!problem) return res.status(404).json({ error: '问题不存在' });
    
    db.run(
      `INSERT INTO rectifications (id, problem_id, description, photo_url, rectifier, rectifier_phone, completed_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [id, problem_id, description, photo_url, rectifier, rectifier_phone, completedAt],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          db.run(`UPDATE problems SET status = 'rectified', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [problem_id]);
          
          await addModificationHistory('problem', problem_id, 'status', problem.status, 'rectified', operator, 'status_change', '提交整改');
          await addTimeline('problem', problem_id, 'submit_rectification', '提交整改', operator, { rectificationId: id, description });
          res.status(201).json({ id, status: 'submitted', photo_url });
        }
      }
    );
  });
});

module.exports = router;
