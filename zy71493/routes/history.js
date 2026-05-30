const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDb();
  const { question_id, operation_type, limit } = req.query;
  let sql = `
    SELECT h.*, q.title, q.question_type, q.audio_file
    FROM practice_history h
    LEFT JOIN questions q ON h.question_id = q.id
    WHERE 1=1
  `;
  const params = [];

  if (question_id) {
    sql += ` AND h.question_id = ?`;
    params.push(question_id);
  }
  if (operation_type) {
    sql += ` AND h.operation_type = ?`;
    params.push(operation_type);
  }
  sql += ` ORDER BY h.operation_time DESC`;
  if (limit) {
    sql += ` LIMIT ?`;
    params.push(parseInt(limit));
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    rows.forEach(row => {
      if (row.before_data) {
        try { row.before_data = JSON.parse(row.before_data); } catch(e) {}
      }
      if (row.after_data) {
        try { row.after_data = JSON.parse(row.after_data); } catch(e) {}
      }
    });
    res.json(rows);
  });
});

router.get('/question/:questionId', (req, res) => {
  const db = getDb();
  const { questionId } = req.params;

  db.all(`
    SELECT h.*, q.title, q.question_type, q.audio_file
    FROM practice_history h
    LEFT JOIN questions q ON h.question_id = q.id
    WHERE h.question_id = ?
    ORDER BY h.operation_time DESC
  `, [questionId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    rows.forEach(row => {
      if (row.before_data) {
        try { row.before_data = JSON.parse(row.before_data); } catch(e) {}
      }
      if (row.after_data) {
        try { row.after_data = JSON.parse(row.after_data); } catch(e) {}
      }
    });
    res.json(rows);
  });
});

router.get('/stats', (req, res) => {
  const db = getDb();
  const { start_date, end_date } = req.query;

  let sql = `
    SELECT
      operation_type,
      COUNT(*) as count
    FROM practice_history
    WHERE 1=1
  `;
  const params = [];

  if (start_date) {
    sql += ` AND operation_time >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND operation_time <= ?`;
    params.push(end_date);
  }
  sql += ` GROUP BY operation_type ORDER BY count DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.get(`
      SELECT
        COUNT(*) as total_operations,
        COUNT(DISTINCT question_id) as unique_questions,
        DATE(operation_time) as date
      FROM practice_history
      WHERE 1=1
      ${start_date ? ' AND operation_time >= ?' : ''}
      ${end_date ? ' AND operation_time <= ?' : ''}
      GROUP BY DATE(operation_time)
      ORDER BY date DESC
      LIMIT 7
    `, params, (err, dailyStats) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ by_operation: rows, daily: dailyStats });
    });
  });
});

module.exports = router;
