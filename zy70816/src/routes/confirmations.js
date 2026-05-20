const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { batch_no, store_code, confirmation_type, notes, created_by } = req.body;

    if (!batch_no || !store_code || !confirmation_type) {
      return res.status(400).json({ error: '批号、门店编码、确认类型为必填项' });
    }

    const validTypes = ['freeze', 'recall', 'transfer', 'substitute', 'expiry', 'other'];
    if (!validTypes.includes(confirmation_type)) {
      return res.status(400).json({ error: '无效的确认类型，可选: freeze, recall, transfer, substitute, expiry, other' });
    }

    const batch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE batch_no = ?', [batch_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const store = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM stores WHERE store_code = ?', [store_code], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!store) {
      return res.status(404).json({ error: '门店不存在' });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO store_confirmations (batch_id, store_id, confirmation_type, notes, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [batch.id, store.id, confirmation_type, notes, created_by || '系统'],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    res.status(201).json({
      message: '门店确认已创建，等待门店处理',
      id: result.id,
      batch_no,
      store_code,
      confirmation_type
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const { confirmed_by, notes } = req.body;

    const confirmation = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM store_confirmations WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!confirmation) {
      return res.status(404).json({ error: '确认记录不存在' });
    }

    if (confirmation.status !== 'pending') {
      return res.status(400).json({ error: '该确认记录已处理' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE store_confirmations SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
         WHERE id = ?`,
        [confirmed_by || '门店管理员', notes, req.params.id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const batch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE id = ?', [confirmation.batch_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO approvals (batch_id, action, status, reason, handler, notes, previous_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          confirmation.batch_id,
          '门店确认',
          batch.status,
          `门店确认类型: ${confirmation.confirmation_type}`,
          confirmed_by || '门店管理员',
          notes || `门店确认完成`,
          batch.status
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      message: '门店确认成功',
      id: req.params.id,
      confirmed_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { rejected_by, reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: '驳回原因必填' });
    }

    const confirmation = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM store_confirmations WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!confirmation) {
      return res.status(404).json({ error: '确认记录不存在' });
    }

    if (confirmation.status !== 'pending') {
      return res.status(400).json({ error: '该确认记录已处理' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE store_confirmations SET status = 'rejected', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP, notes = ?
         WHERE id = ?`,
        [rejected_by || '门店管理员', reason, req.params.id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      message: '门店确认已驳回',
      id: req.params.id,
      reason
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { store_id, batch_id, status, confirmation_type } = req.query;
    let sql = `SELECT sc.*, s.store_code, s.store_name, b.batch_no, p.product_name
               FROM store_confirmations sc
               LEFT JOIN stores s ON sc.store_id = s.id
               LEFT JOIN batches b ON sc.batch_id = b.id
               LEFT JOIN products p ON b.product_id = p.id
               WHERE 1=1`;
    const params = [];

    if (store_id) {
      sql += ` AND sc.store_id = ?`;
      params.push(store_id);
    }
    if (batch_id) {
      sql += ` AND sc.batch_id = ?`;
      params.push(batch_id);
    }
    if (status) {
      sql += ` AND sc.status = ?`;
      params.push(status);
    }
    if (confirmation_type) {
      sql += ` AND sc.confirmation_type = ?`;
      params.push(confirmation_type);
    }

    sql += ` ORDER BY sc.created_at DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) throw err;
      res.json(rows);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const { store_code } = req.query;
    let sql = `SELECT sc.*, s.store_code, s.store_name, b.batch_no, p.product_name, b.expiry_date, b.is_frozen
               FROM store_confirmations sc
               LEFT JOIN stores s ON sc.store_id = s.id
               LEFT JOIN batches b ON sc.batch_id = b.id
               LEFT JOIN products p ON b.product_id = p.id
               WHERE sc.status = 'pending'`;
    const params = [];

    if (store_code) {
      const store = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM stores WHERE store_code = ?', [store_code], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (store) {
        sql += ` AND sc.store_id = ?`;
        params.push(store.id);
      }
    }

    sql += ` ORDER BY sc.created_at ASC`;

    db.all(sql, params, (err, rows) => {
      if (err) throw err;
      res.json({ count: rows.length, pending_confirmations: rows });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const confirmation = await new Promise((resolve, reject) => {
      db.get(
        `SELECT sc.*, s.store_code, s.store_name, b.batch_no, p.product_name
         FROM store_confirmations sc
         LEFT JOIN stores s ON sc.store_id = s.id
         LEFT JOIN batches b ON sc.batch_id = b.id
         LEFT JOIN products p ON b.product_id = p.id
         WHERE sc.id = ?`,
        [req.params.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!confirmation) {
      return res.status(404).json({ error: '确认记录不存在' });
    }

    res.json(confirmation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
