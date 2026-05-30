const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDb();
  const { type, status, question_id } = req.query;
  let sql = `
    SELECT a.*, q.title, q.question_type, q.audio_file, q.standard_answer as q_standard_answer,
           ar.student_answer, ar.submit_time, ar.answer_source
    FROM anomalies a
    LEFT JOIN questions q ON a.question_id = q.id
    LEFT JOIN answer_records ar ON a.answer_id = ar.id
    WHERE 1=1
  `;
  const params = [];

  if (type) {
    sql += ` AND a.type = ?`;
    params.push(type);
  }
  if (status) {
    sql += ` AND a.status = ?`;
    params.push(status);
  }
  if (question_id) {
    sql += ` AND a.question_id = ?`;
    params.push(question_id);
  }
  sql += ` ORDER BY a.created_at DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    rows.forEach(row => {
      if (row.related_answer_ids) {
        try { row.related_answer_ids = JSON.parse(row.related_answer_ids); } catch(e) {}
      }
    });
    res.json(rows);
  });
});

router.get('/stats', (req, res) => {
  const db = getDb();
  db.all(`
    SELECT
      type,
      status,
      COUNT(*) as count
    FROM anomalies
    GROUP BY type, status
    ORDER BY type, status
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM anomalies
    `, (err, summary) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ by_type_status: rows, summary });
    });
  });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status, handle_note, operator = 'teacher' } = req.body;

  if (!status) {
    res.status(400).json({ error: '请提供状态' });
    return;
  }

  const validStatuses = ['pending', 'confirmed', 'rejected', 'resolved'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: '无效的状态值' });
    return;
  }

  db.get(`SELECT * FROM anomalies WHERE id = ?`, [id], (err, anomaly) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!anomaly) {
      res.status(404).json({ error: '异常记录不存在' });
      return;
    }

    db.serialize(() => {
      db.run(`
        UPDATE anomalies
        SET status = ?, handled_by = ?, handled_at = datetime('now', 'localtime'),
            handle_note = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [status, operator, handle_note || '', id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        db.run(`
          INSERT INTO correction_history (
            target_table, target_id, field_name, old_value, new_value,
            reason, operator, corrected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `, [
          'anomalies', id, 'status', anomaly.status, status,
          handle_note || `异常处理: ${anomaly.status} -> ${status}`, operator
        ]);

        if (status === 'rejected' && anomaly.answer_id) {
          db.run(`
            UPDATE error_records
            SET is_resolved = 1, resolved_at = datetime('now', 'localtime'),
                resolved_note = '异常已驳回，不视为有效错误',
                updated_at = datetime('now', 'localtime')
            WHERE answer_id = ?
          `, [anomaly.answer_id]);
        }

        if (status === 'confirmed' && anomaly.answer_id) {
          db.run(`
            UPDATE error_records
            SET is_resolved = 0,
                updated_at = datetime('now', 'localtime'),
                remark = COALESCE(remark, '') || ' 异常已确认，确认为有效错误'
            WHERE answer_id = ?
          `, [anomaly.answer_id]);
        }

        res.json({
          message: '处理成功',
          changes: this.changes,
          old_status: anomaly.status,
          new_status: status
        });
      });
    });
  });
});

router.post('/:id/confirm', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { handle_note, operator = 'teacher' } = req.body;

  req.body.status = 'confirmed';
  req.body.operator = operator;
  req.body.handle_note = handle_note || '确认异常有效';

  router.handle({ ...req, method: 'PUT', url: `/${id}` }, res, () => {});
});

router.post('/:id/reject', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { handle_note, operator = 'teacher' } = req.body;

  req.body.status = 'rejected';
  req.body.operator = operator;
  req.body.handle_note = handle_note || '驳回异常，不视为有效错误';

  router.handle({ ...req, method: 'PUT', url: `/${id}` }, res, () => {});
});

router.post('/:id/resolve', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { handle_note, operator = 'teacher', merge_error_ids } = req.body;

  db.get(`SELECT * FROM anomalies WHERE id = ?`, [id], (err, anomaly) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!anomaly) {
      res.status(404).json({ error: '异常记录不存在' });
      return;
    }

    if (anomaly.type === 'duplicate_unmerged' && merge_error_ids && merge_error_ids.length >= 2) {
      const targetId = merge_error_ids[0];
      const sourceIds = merge_error_ids.slice(1);

      db.get(`SELECT * FROM error_records WHERE id = ?`, [targetId], (err, target) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const placeholders = sourceIds.map(() => '?').join(',');
        db.all(`SELECT * FROM error_records WHERE id IN (${placeholders})`, sourceIds, (err, sources) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          let totalPractice = target.practice_count;
          sources.forEach(s => { totalPractice += s.practice_count; });

          db.run(`
            UPDATE error_records
            SET practice_count = ?, updated_at = datetime('now', 'localtime'),
                remark = COALESCE(remark, '') || ' 合并记录: ' || sourceIds.join(',')
            WHERE id = ?
          `, [totalPractice, targetId]);

          db.run(`
            DELETE FROM error_records WHERE id IN (${placeholders})
          `, sourceIds);

          req.body.status = 'resolved';
          req.body.operator = operator;
          req.body.handle_note = handle_note || `已合并错题ID: ${merge_error_ids.join(', ')}，共${totalPractice}次练习`;

          router.handle({ ...req, method: 'PUT', url: `/${id}` }, res, () => {});
        });
      });
    } else {
      req.body.status = 'resolved';
      req.body.operator = operator;
      req.body.handle_note = handle_note || '异常已处理完成';

      router.handle({ ...req, method: 'PUT', url: `/${id}` }, res, () => {});
    }
  });
});

module.exports = router;
