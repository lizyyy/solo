const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDb();
  const { target_table, target_id, field_name, operator, limit } = req.query;
  let sql = `SELECT * FROM correction_history WHERE 1=1`;
  const params = [];

  if (target_table) {
    sql += ` AND target_table = ?`;
    params.push(target_table);
  }
  if (target_id) {
    sql += ` AND target_id = ?`;
    params.push(target_id);
  }
  if (field_name) {
    sql += ` AND field_name = ?`;
    params.push(field_name);
  }
  if (operator) {
    sql += ` AND operator = ?`;
    params.push(operator);
  }
  sql += ` ORDER BY corrected_at DESC`;
  if (limit) {
    sql += ` LIMIT ?`;
    params.push(parseInt(limit));
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/target/:targetTable/:targetId', (req, res) => {
  const db = getDb();
  const { targetTable, targetId } = req.params;

  db.all(`
    SELECT * FROM correction_history
    WHERE target_table = ? AND target_id = ?
    ORDER BY corrected_at DESC
  `, [targetTable, targetId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/monthly-review', (req, res) => {
  const db = getDb();
  const { year, month } = req.query;

  let dateFilter = '';
  const params = [];

  if (year && month) {
    const m = String(month).padStart(2, '0');
    dateFilter = ` AND strftime('%Y-%m', corrected_at) = ?`;
    params.push(`${year}-${m}`);
  } else {
    dateFilter = ` AND strftime('%Y-%m', corrected_at) = strftime('%Y-%m', 'now', 'localtime')`;
  }

  db.all(`
    SELECT
      target_table,
      field_name,
      COUNT(*) as correction_count,
      COUNT(DISTINCT target_id) as affected_records,
      GROUP_CONCAT(DISTINCT reason) as reasons
    FROM correction_history
    WHERE 1=1 ${dateFilter}
    GROUP BY target_table, field_name
    ORDER BY correction_count DESC
  `, params, (err, byField) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.all(`
      SELECT
        DATE(corrected_at) as date,
        target_table,
        COUNT(*) as count
      FROM correction_history
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE(corrected_at), target_table
      ORDER BY date DESC
    `, params, (err, daily) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.all(`
        SELECT * FROM correction_history
        WHERE 1=1 ${dateFilter}
        ORDER BY corrected_at DESC
      `, params, (err, allCorrections) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        res.json({
          period: year && month ? `${year}-${month}` : '本月',
          summary: {
            by_field: byField,
            daily: daily,
            total_corrections: allCorrections.length,
            unique_operators: [...new Set(allCorrections.map(c => c.operator))].length
          },
          details: allCorrections
        });
      });
    });
  });
});

router.post('/revert', (req, res) => {
  const db = getDb();
  const { correction_id, operator = 'teacher', reason } = req.body;

  if (!correction_id) {
    res.status(400).json({ error: '请提供要回滚的修正记录ID' });
    return;
  }

  db.get(`SELECT * FROM correction_history WHERE id = ?`, [correction_id], (err, correction) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!correction) {
      res.status(404).json({ error: '修正记录不存在' });
      return;
    }

    const { target_table, target_id, field_name, old_value, new_value } = correction;

    db.run(`
      UPDATE ${target_table}
      SET ${field_name} = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [old_value, target_id], function(err) {
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
        target_table, target_id, field_name, new_value, old_value,
        reason || `回滚修正记录 #${correction_id}`, operator
      ]);

      res.json({
        message: '回滚成功',
        reverted_correction: correction_id,
        field: field_name,
        from: new_value,
        to: old_value
      });
    });
  });
});

module.exports = router;
