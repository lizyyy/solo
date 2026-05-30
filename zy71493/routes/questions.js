const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDb();
  const { type, difficulty } = req.query;
  let sql = `SELECT * FROM questions WHERE 1=1`;
  const params = [];

  if (type) {
    sql += ` AND question_type = ?`;
    params.push(type);
  }
  if (difficulty) {
    sql += ` AND difficulty = ?`;
    params.push(difficulty);
  }
  sql += ` ORDER BY created_at DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.get(`SELECT * FROM questions WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { question_type, title, audio_file, standard_answer, description, difficulty, tags } = req.body;

  if (!question_type || !title || !standard_answer) {
    res.status(400).json({ error: '缺少必填字段' });
    return;
  }

  const sql = `
    INSERT INTO questions (question_type, title, audio_file, standard_answer, description, difficulty, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [question_type, title, audio_file, standard_answer, description, difficulty || 'medium', tags], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({ id: this.lastID, message: '创建成功' });
  });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { question_type, title, audio_file, standard_answer, description, difficulty, tags } = req.body;
  const operator = req.body.operator || 'teacher';

  db.get(`SELECT * FROM questions WHERE id = ?`, [id], (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRow) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const updates = [];
    const params = [];
    const corrections = [];

    const fields = ['question_type', 'title', 'audio_file', 'standard_answer', 'description', 'difficulty', 'tags'];
    fields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== oldRow[field]) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
        corrections.push({
          field,
          old_value: oldRow[field],
          new_value: req.body[field],
          reason: req.body.correction_reason || `更新${field}字段`
        });
      }
    });

    if (updates.length === 0) {
      res.json({ message: '没有需要更新的内容' });
      return;
    }

    updates.push(`updated_at = datetime('now', 'localtime')`);
    params.push(id);

    const sql = `UPDATE questions SET ${updates.join(', ')} WHERE id = ?`;

    db.run(sql, params, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const correctionStmt = db.prepare(`
        INSERT INTO correction_history (target_table, target_id, field_name, old_value, new_value, reason, operator, corrected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `);

      corrections.forEach(c => {
        correctionStmt.run(['questions', id, c.field, c.old_value, c.new_value, c.reason, operator]);
      });
      correctionStmt.finalize();

      res.json({ message: '更新成功', changes: this.changes, corrections: corrections.length });
    });
  });
});

module.exports = router;
