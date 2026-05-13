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
    const activities = await allAsync('SELECT * FROM activity_applications ORDER BY created_at DESC');
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const activity = await getAsync('SELECT * FROM activity_applications WHERE id = ?', [req.params.id]);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await allAsync('SELECT * FROM activity_history WHERE activity_id = ? ORDER BY modified_at DESC', [req.params.id]);
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
  const { budget_id, activity_name, activity_date, location, expected_participants, estimated_amount, description, applicant } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    const budget = await getAsync('SELECT * FROM club_budgets WHERE id = ?', [budget_id]);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    await runAsync(
      `INSERT INTO activity_applications (id, budget_id, activity_name, activity_date, location, expected_participants, estimated_amount, description, status, applicant, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [id, budget_id, activity_name, activity_date, location, expected_participants, estimated_amount, description, applicant, now, now]
    );

    await logOperation('create', 'activity', id, applicant, `提交活动申请: ${activity_name}`);

    const activity = await getAsync('SELECT * FROM activity_applications WHERE id = ?', [id]);
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { activity_name, activity_date, location, expected_participants, estimated_amount, description, modified_by } = req.body;
  const now = new Date().toISOString();

  try {
    const oldActivity = await getAsync('SELECT * FROM activity_applications WHERE id = ?', [req.params.id]);
    if (!oldActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await runAsync(
      `UPDATE activity_applications 
       SET activity_name = ?, activity_date = ?, location = ?, expected_participants = ?, estimated_amount = ?, description = ?, updated_at = ?, version = version + 1
       WHERE id = ?`,
      [activity_name, activity_date, location, expected_participants, estimated_amount, description, now, req.params.id]
    );

    const newActivity = await getAsync('SELECT * FROM activity_applications WHERE id = ?', [req.params.id]);

    await runAsync(
      `INSERT INTO activity_history (activity_id, before_data, after_data, modified_by, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, JSON.stringify(oldActivity), JSON.stringify(newActivity), modified_by, now]
    );

    await logOperation('update', 'activity', req.params.id, modified_by, '更新活动信息', oldActivity, newActivity);

    res.json(newActivity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status, reviewer, review_comment } = req.body;
  const now = new Date().toISOString();

  try {
    const oldActivity = await getAsync('SELECT * FROM activity_applications WHERE id = ?', [req.params.id]);
    if (!oldActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await runAsync(
      `UPDATE activity_applications SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
      [status, now, req.params.id]
    );

    const newActivity = await getAsync('SELECT * FROM activity_applications WHERE id = ?', [req.params.id]);

    await logOperation('status_change', 'activity', req.params.id, reviewer, `活动状态变更为: ${status}, 备注: ${review_comment || ''}`, { status: oldActivity.status }, { status: status });

    res.json(newActivity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/purchases', async (req, res) => {
  try {
    const purchases = await allAsync('SELECT * FROM purchase_items WHERE activity_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
