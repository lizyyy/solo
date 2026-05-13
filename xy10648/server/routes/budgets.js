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
    const budgets = await allAsync('SELECT * FROM club_budgets ORDER BY created_at DESC');
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const budget = await getAsync('SELECT * FROM club_budgets WHERE id = ?', [req.params.id]);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await allAsync('SELECT * FROM budget_history WHERE budget_id = ? ORDER BY modified_at DESC', [req.params.id]);
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
  const { club_name, fiscal_year, total_amount, created_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  const remaining_amount = total_amount;

  try {
    await runAsync(
      `INSERT INTO club_budgets (id, club_name, fiscal_year, total_amount, used_amount, remaining_amount, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, 'active', ?, ?, ?)`,
      [id, club_name, fiscal_year, total_amount, remaining_amount, created_by, now, now]
    );

    await logOperation('create', 'budget', id, created_by, `创建${club_name}${fiscal_year}年度预算`);

    const budget = await getAsync('SELECT * FROM club_budgets WHERE id = ?', [id]);
    res.status(201).json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { club_name, fiscal_year, total_amount, status, modified_by } = req.body;
  const now = new Date().toISOString();

  try {
    const oldBudget = await getAsync('SELECT * FROM club_budgets WHERE id = ?', [req.params.id]);
    if (!oldBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const used_amount = oldBudget.used_amount;
    const remaining_amount = total_amount - used_amount;

    await runAsync(
      `UPDATE club_budgets 
       SET club_name = ?, fiscal_year = ?, total_amount = ?, remaining_amount = ?, status = ?, updated_at = ?, version = version + 1
       WHERE id = ?`,
      [club_name, fiscal_year, total_amount, remaining_amount, status, now, req.params.id]
    );

    const newBudget = await getAsync('SELECT * FROM club_budgets WHERE id = ?', [req.params.id]);

    await runAsync(
      `INSERT INTO budget_history (budget_id, before_data, after_data, modified_by, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, JSON.stringify(oldBudget), JSON.stringify(newBudget), modified_by, now]
    );

    await logOperation('update', 'budget', req.params.id, modified_by, '更新预算信息', oldBudget, newBudget);

    res.json(newBudget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status, modified_by } = req.body;
  const now = new Date().toISOString();

  try {
    const oldBudget = await getAsync('SELECT * FROM club_budgets WHERE id = ?', [req.params.id]);
    if (!oldBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    await runAsync(
      `UPDATE club_budgets SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
      [status, now, req.params.id]
    );

    const newBudget = await getAsync('SELECT * FROM club_budgets WHERE id = ?', [req.params.id]);

    await logOperation('status_change', 'budget', req.params.id, modified_by, `预算状态变更为: ${status}`, { status: oldBudget.status }, { status: status });

    res.json(newBudget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
