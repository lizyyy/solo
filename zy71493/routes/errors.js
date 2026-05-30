const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDb();
  const { type, resolved, question_id } = req.query;
  let sql = `
    SELECT e.*, q.title, q.question_type, q.audio_file,
           a.student_answer as latest_student_answer, a.submit_time,
           a.answer_source, a.remark as answer_remark
    FROM error_records e
    LEFT JOIN questions q ON e.question_id = q.id
    LEFT JOIN answer_records a ON e.answer_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (type) {
    sql += ` AND e.error_type = ?`;
    params.push(type);
  }
  if (resolved !== undefined) {
    sql += ` AND e.is_resolved = ?`;
    params.push(resolved === 'true' || resolved === '1' ? 1 : 0);
  }
  if (question_id) {
    sql += ` AND e.question_id = ?`;
    params.push(question_id);
  }
  sql += ` ORDER BY e.updated_at DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/stats', (req, res) => {
  const db = getDb();
  db.all(`
    SELECT
      error_type,
      COUNT(*) as total,
      SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN is_resolved = 0 THEN 1 ELSE 0 END) as unresolved
    FROM error_records
    GROUP BY error_type
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.get(`
      SELECT
        COUNT(*) as total_errors,
        SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) as total_resolved,
        SUM(practice_count) as total_practices
      FROM error_records
    `, (err, summary) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ by_type: rows, summary });
    });
  });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { error_type, error_category, remark, is_resolved, resolved_note } = req.body;
  const operator = req.body.operator || 'teacher';
  const correctionReason = req.body.correction_reason || '修正错题记录';

  db.get(`SELECT * FROM error_records WHERE id = ?`, [id], (err, oldRecord) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRecord) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }

    const updates = [];
    const params = [];
    const corrections = [];

    if (error_type !== undefined && error_type !== oldRecord.error_type) {
      updates.push('error_type = ?');
      params.push(error_type);
      corrections.push({ field: 'error_type', old_value: oldRecord.error_type, new_value: error_type });
    }
    if (error_category !== undefined && error_category !== oldRecord.error_category) {
      updates.push('error_category = ?');
      params.push(error_category);
      corrections.push({ field: 'error_category', old_value: oldRecord.error_category, new_value: error_category });
    }
    if (remark !== undefined && remark !== oldRecord.remark) {
      updates.push('remark = ?');
      params.push(remark);
      corrections.push({ field: 'remark', old_value: oldRecord.remark, new_value: remark });
    }
    if (is_resolved !== undefined && is_resolved !== oldRecord.is_resolved) {
      updates.push('is_resolved = ?');
      params.push(is_resolved ? 1 : 0);
      corrections.push({
        field: 'is_resolved',
        old_value: String(oldRecord.is_resolved),
        new_value: String(is_resolved ? 1 : 0)
      });
      if (is_resolved) {
        updates.push('resolved_at = datetime(\'now\', \'localtime\')');
      }
    }
    if (resolved_note !== undefined && resolved_note !== oldRecord.resolved_note) {
      updates.push('resolved_note = ?');
      params.push(resolved_note);
      corrections.push({ field: 'resolved_note', old_value: oldRecord.resolved_note, new_value: resolved_note });
    }

    if (updates.length === 0) {
      res.json({ message: '没有需要更新的内容' });
      return;
    }

    updates.push('updated_at = datetime(\'now\', \'localtime\')');
    params.push(id);

    const sql = `UPDATE error_records SET ${updates.join(', ')} WHERE id = ?`;

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
        correctionStmt.run([
          'error_records', id, c.field, c.old_value, c.new_value,
          c.reason || correctionReason, operator
        ]);
      });
      correctionStmt.finalize();

      res.json({
        message: '更新成功',
        changes: this.changes,
        corrections: corrections.length
      });
    });
  });
});

router.post('/:id/resolve', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { resolved_note, operator = 'teacher' } = req.body;

  db.get(`SELECT * FROM error_records WHERE id = ?`, [id], (err, oldRecord) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRecord) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    if (oldRecord.is_resolved) {
      res.json({ message: '该错题已标记为已解决' });
      return;
    }

    db.run(`
      UPDATE error_records
      SET is_resolved = 1, resolved_at = datetime('now', 'localtime'),
          resolved_note = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [resolved_note || '已掌握，标记为解决', id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.run(`
        INSERT INTO correction_history (
          target_table, target_id, field_name, old_value, new_value, reason, operator, corrected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `, ['error_records', id, 'is_resolved', '0', '1', resolved_note || '标记为已解决', operator]);

      res.json({ message: '标记为已解决成功', changes: this.changes });
    });
  });
});

router.post('/:id/merge', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { merge_ids, operator = 'teacher' } = req.body;

  if (!merge_ids || !Array.isArray(merge_ids) || merge_ids.length === 0) {
    res.status(400).json({ error: '请提供要合并的错题ID列表' });
    return;
  }

  db.get(`SELECT * FROM error_records WHERE id = ?`, [id], (err, targetRecord) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!targetRecord) {
      res.status(404).json({ error: '目标错题记录不存在' });
      return;
    }

    const placeholders = merge_ids.map(() => '?').join(',');
    db.all(`SELECT * FROM error_records WHERE id IN (${placeholders})`, merge_ids, (err, sourceRecords) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      let totalPractice = targetRecord.practice_count;
      sourceRecords.forEach(r => {
        totalPractice += r.practice_count;
      });

      db.run(`
        UPDATE error_records
        SET practice_count = ?, updated_at = datetime('now', 'localtime'),
            remark = COALESCE(remark, '') || ' 已合并记录: ' || ?
        WHERE id = ?
      `, [totalPractice, merge_ids.join(','), id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        db.run(`
          INSERT INTO correction_history (
            target_table, target_id, field_name, old_value, new_value, reason, operator, corrected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `, [
          'error_records', id, 'practice_count',
          String(targetRecord.practice_count), String(totalPractice),
          `合并了错题ID: ${merge_ids.join(', ')}`, operator
        ]);

        res.json({
          message: '合并成功',
          target_id: id,
          merged_ids: merge_ids,
          new_practice_count: totalPractice
        });
      });
    });
  });
});

module.exports = router;
