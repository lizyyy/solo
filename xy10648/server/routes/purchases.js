const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function logOperation(operationType, targetType, targetId, operator, details, oldValue = null, newValue = null) {
  const now = new Date().toISOString();
  return runAsync(
    `INSERT INTO operation_logs (operation_type, target_type, target_id, operator, details, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [operationType, targetType, targetId, operator, details, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, now]
  );
}

router.get('/', async (req, res) => {
  try {
    const purchases = await allAsync('SELECT * FROM purchase_items ORDER BY created_at DESC');
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const purchase = await getAsync('SELECT * FROM purchase_items WHERE id = ?', [req.params.id]);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.json(purchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await allAsync('SELECT * FROM purchase_history WHERE purchase_id = ? ORDER BY modified_at DESC', [req.params.id]);
    res.json(history.map(h => ({
      ...h,
      before_data: h.before_data ? JSON.parse(h.before_data) : null,
      after_data: h.after_data ? JSON.parse(h.after_data) : null
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { activity_id, item_name, quantity, unit_price, supplier, purchase_date, created_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  const total_price = quantity * unit_price;

  try {
    await runAsync(
      `INSERT INTO purchase_items (id, activity_id, item_name, quantity, unit_price, total_price, supplier, purchase_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, activity_id, item_name, quantity, unit_price, total_price, supplier, purchase_date, now, now]
    );

    await logOperation('create', 'purchase', id, created_by, `添加采购项: ${item_name}`);

    const purchase = await getAsync('SELECT * FROM purchase_items WHERE id = ?', [id]);
    res.status(201).json(purchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { item_name, quantity, unit_price, supplier, purchase_date, modified_by } = req.body;
  const now = new Date().toISOString();
  const total_price = quantity * unit_price;

  try {
    const oldPurchase = await getAsync('SELECT * FROM purchase_items WHERE id = ?', [req.params.id]);
    if (!oldPurchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    await runAsync(
      `UPDATE purchase_items 
       SET item_name = ?, quantity = ?, unit_price = ?, total_price = ?, supplier = ?, purchase_date = ?, updated_at = ?, version = version + 1
       WHERE id = ?`,
      [item_name, quantity, unit_price, total_price, supplier, purchase_date, now, req.params.id]
    );

    const newPurchase = await getAsync('SELECT * FROM purchase_items WHERE id = ?', [req.params.id]);

    await runAsync(
      `INSERT INTO purchase_history (purchase_id, before_data, after_data, modified_by, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, JSON.stringify(oldPurchase), JSON.stringify(newPurchase), modified_by, now]
    );

    await logOperation('update', 'purchase', req.params.id, modified_by, '更新采购项信息', oldPurchase, newPurchase);

    res.json(newPurchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status, reviewer } = req.body;
  const now = new Date().toISOString();

  try {
    const oldPurchase = await getAsync('SELECT * FROM purchase_items WHERE id = ?', [req.params.id]);
    if (!oldPurchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    await runAsync(
      `UPDATE purchase_items SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
      [status, now, req.params.id]
    );

    const newPurchase = await getAsync('SELECT * FROM purchase_items WHERE id = ?', [req.params.id]);

    await logOperation('status_change', 'purchase', req.params.id, reviewer, `采购项状态变更为: ${status}`, { status: oldPurchase.status }, { status: status });

    res.json(newPurchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
