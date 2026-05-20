const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { original_batch_no, substitute_batch_no, reason, handled_by } = req.body;

    if (!original_batch_no || !substitute_batch_no) {
      return res.status(400).json({ error: '原始批号和替代批号为必填项' });
    }

    if (original_batch_no === substitute_batch_no) {
      return res.status(400).json({ error: '原始批号和替代批号不能相同' });
    }

    const originalBatch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE batch_no = ?', [original_batch_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!originalBatch) {
      return res.status(404).json({ error: '原始批次不存在' });
    }

    const substituteBatch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE batch_no = ?', [substitute_batch_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!substituteBatch) {
      return res.status(404).json({ error: '替代批次不存在' });
    }

    const existing = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM substitute_products WHERE original_batch_id = ? AND substitute_batch_id = ?',
        [originalBatch.id, substituteBatch.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existing) {
      return res.status(400).json({ error: '该替代关系已存在' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO substitute_products (original_batch_id, substitute_batch_id, reason, handled_by)
         VALUES (?, ?, ?, ?)`,
        [originalBatch.id, substituteBatch.id, reason || '召回/冻结替代', handled_by || '系统'],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO approvals (batch_id, action, status, reason, handler, notes, previous_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          originalBatch.id,
          '设置替代耗材',
          originalBatch.status,
          reason || '召回/冻结替代',
          handled_by || '系统',
          `替代批号: ${substitute_batch_no}`,
          originalBatch.status
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({
      message: '替代耗材设置成功',
      original_batch: original_batch_no,
      substitute_batch: substitute_batch_no,
      reason: reason || '召回/冻结替代'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { original_batch_no, substitute_batch_no } = req.query;
    let sql = `SELECT sp.*,
                      ob.batch_no as original_batch_no, op.product_name as original_product_name,
                      sb.batch_no as substitute_batch_no, sp2.product_name as substitute_product_name
               FROM substitute_products sp
               LEFT JOIN batches ob ON sp.original_batch_id = ob.id
               LEFT JOIN products op ON ob.product_id = op.id
               LEFT JOIN batches sb ON sp.substitute_batch_id = sb.id
               LEFT JOIN products sp2 ON sb.product_id = sp2.id
               WHERE 1=1`;
    const params = [];

    if (original_batch_no) {
      sql += ` AND ob.batch_no = ?`;
      params.push(original_batch_no);
    }
    if (substitute_batch_no) {
      sql += ` AND sb.batch_no = ?`;
      params.push(substitute_batch_no);
    }

    sql += ` ORDER BY sp.created_at DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) throw err;
      res.json(rows);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/original/:batch_no', async (req, res) => {
  try {
    const batch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE batch_no = ?', [req.params.batch_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const substitutes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT sp.*, sb.batch_no, p.product_name, p.specification, s.supplier_name,
                sb.production_date, sb.expiry_date, sb.status, sb.is_frozen
         FROM substitute_products sp
         LEFT JOIN batches sb ON sp.substitute_batch_id = sb.id
         LEFT JOIN products p ON sb.product_id = p.id
         LEFT JOIN suppliers s ON sb.supplier_id = s.id
         WHERE sp.original_batch_id = ?
         ORDER BY sp.created_at DESC`,
        [batch.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      original_batch: req.params.batch_no,
      substitute_count: substitutes.length,
      substitutes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/substitute/:batch_no', async (req, res) => {
  try {
    const batch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE batch_no = ?', [req.params.batch_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const originals = await new Promise((resolve, reject) => {
      db.all(
        `SELECT sp.*, ob.batch_no, p.product_name, p.specification, s.supplier_name,
                ob.production_date, ob.expiry_date, ob.status, ob.is_frozen
         FROM substitute_products sp
         LEFT JOIN batches ob ON sp.original_batch_id = ob.id
         LEFT JOIN products p ON ob.product_id = p.id
         LEFT JOIN suppliers s ON ob.supplier_id = s.id
         WHERE sp.substitute_batch_id = ?
         ORDER BY sp.created_at DESC`,
        [batch.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      substitute_batch: req.params.batch_no,
      used_as_substitute_for_count: originals.length,
      original_batches: originals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM substitute_products WHERE id = ?', [req.params.id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (result === 0) {
      return res.status(404).json({ error: '替代关系不存在' });
    }

    res.json({ message: '替代关系已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
