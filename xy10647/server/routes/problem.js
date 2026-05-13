const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { generateId, addTimeline, addModificationHistory, getTimeline, getModificationHistory, idempotentMiddleware } = require('../utils');

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
    cb(null, 'problem-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.get('/', (req, res) => {
  const { inspection_id, store_id, status, rectifier } = req.query;
  let query = `SELECT * FROM problems WHERE 1=1`;
  const params = [];
  
  if (inspection_id) {
    query += ` AND inspection_id = ?`;
    params.push(inspection_id);
  }
  if (store_id) {
    query += ` AND store_id = ?`;
    params.push(store_id);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
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
  db.get(`SELECT * FROM problems WHERE id = ?`, [req.params.id], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '问题不存在' });
    } else {
      const rectifications = await new Promise((resolve) => {
        db.all(`SELECT * FROM rectifications WHERE problem_id = ? ORDER BY created_at DESC`, [req.params.id], (err, rows) => {
          resolve(err ? [] : rows);
        });
      });
      const reviews = await new Promise((resolve) => {
        db.all(`SELECT * FROM reviews WHERE problem_id = ? ORDER BY created_at DESC`, [req.params.id], (err, rows) => {
          resolve(err ? [] : rows);
        });
      });
      const timeline = await getTimeline('problem', req.params.id);
      const history = await getModificationHistory('problem', req.params.id);
      res.json({ ...row, rectifications, reviews, timeline, modificationHistory: history });
    }
  });
});

router.post('/', upload.single('photo'), idempotentMiddleware, (req, res) => {
  const { inspection_id, store_id, store_name, category, description, severity, points_deducted, deadline, rectifier, rectifier_phone, operator } = req.body;
  const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
  const id = generateId();
  
  db.run(
    `INSERT INTO problems (id, inspection_id, store_id, store_name, category, description, photo_url, severity, points_deducted, deadline, rectifier, rectifier_phone, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, inspection_id, store_id, store_name, category, description, photo_url, severity || 'normal', points_deducted || 0, deadline, rectifier, rectifier_phone],
    async (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        await addTimeline('problem', id, 'create', '创建问题记录', operator, { description, category, severity, rectifier });
        if (inspection_id) {
          await addTimeline('inspection', inspection_id, 'add_problem', '添加问题', operator, { problemId: id, description });
        }
        res.status(201).json({ id, description, status: 'pending', photo_url });
      }
    }
  );
});

router.put('/:id', upload.single('photo'), idempotentMiddleware, (req, res) => {
  const { category, description, severity, points_deducted, deadline, rectifier, rectifier_phone, operator, reason } = req.body;
  const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
  
  db.get(`SELECT * FROM problems WHERE id = ?`, [req.params.id], async (err, oldProblem) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldProblem) return res.status(404).json({ error: '问题不存在' });
    
    const updates = [];
    const params = [];
    const fields = { category, description, severity, points_deducted, deadline, rectifier, rectifier_phone };
    if (photo_url) fields.photo_url = photo_url;
    
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== oldProblem[key]) {
        updates.push(`${key} = ?`);
        params.push(value);
        await addModificationHistory('problem', req.params.id, key, oldProblem[key], value, operator, 'update', reason);
      }
    }
    
    if (updates.length === 0) {
      return res.json({ message: '没有需要更新的内容' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    
    db.run(
      `UPDATE problems SET ${updates.join(', ')} WHERE id = ?`,
      params,
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          await addTimeline('problem', req.params.id, 'update', '更新问题信息', operator, { reason });
          res.json({ message: '更新成功' });
        }
      }
    );
  });
});

router.post('/:id/assign', idempotentMiddleware, (req, res) => {
  const { rectifier, rectifier_phone, operator } = req.body;
  
  db.get(`SELECT * FROM problems WHERE id = ?`, [req.params.id], async (err, problem) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!problem) return res.status(404).json({ error: '问题不存在' });
    
    const oldRectifier = problem.rectifier;
    
    db.run(
      `UPDATE problems SET rectifier = ?, rectifier_phone = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [rectifier, rectifier_phone, req.params.id],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          await addModificationHistory('problem', req.params.id, 'rectifier', oldRectifier, rectifier, operator, 'assign', '分配整改负责人');
          await addModificationHistory('problem', req.params.id, 'status', problem.status, 'assigned', operator, 'status_change', '分配整改');
          await addTimeline('problem', req.params.id, 'assign', `分配整改负责人: ${rectifier}`, operator, { oldRectifier, newRectifier: rectifier });
          res.json({ message: '分配成功', status: 'assigned', rectifier });
        }
      }
    );
  });
});

router.post('/:id/set-deadline', idempotentMiddleware, (req, res) => {
  const { deadline, operator } = req.body;
  
  db.get(`SELECT * FROM problems WHERE id = ?`, [req.params.id], async (err, problem) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!problem) return res.status(404).json({ error: '问题不存在' });
    
    const oldDeadline = problem.deadline;
    
    db.run(
      `UPDATE problems SET deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [deadline, req.params.id],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          await addModificationHistory('problem', req.params.id, 'deadline', oldDeadline, deadline, operator, 'update', '设置整改期限');
          await addTimeline('problem', req.params.id, 'set_deadline', `设置整改期限: ${deadline}`, operator, { oldDeadline, newDeadline: deadline });
          res.json({ message: '设置期限成功', deadline });
        }
      }
    );
  });
});

module.exports = router;
