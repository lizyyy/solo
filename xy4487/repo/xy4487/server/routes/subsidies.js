const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  try {
    const subsidies = db.prepare(`
      SELECT os.*, 
             p.plot_name,
             p.farmer_name,
             p.area as plot_area,
             r.start_time as reservation_time,
             r.work_type
      FROM oil_subsidies os
      LEFT JOIN plots p ON os.plot_id = p.id
      LEFT JOIN reservations r ON os.reservation_id = r.id
      ORDER BY os.subsidy_date DESC
    `).all();

    res.json(subsidies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const subsidy = db.prepare(`
      SELECT os.*, 
             p.plot_name,
             p.farmer_name,
             p.area as plot_area,
             r.start_time as reservation_time,
             r.work_type,
             m.machine_name
      FROM oil_subsidies os
      LEFT JOIN plots p ON os.plot_id = p.id
      LEFT JOIN reservations r ON os.reservation_id = r.id
      LEFT JOIN machines m ON r.machine_id = m.id
      WHERE os.id = ?
    `).get(req.params.id);

    if (!subsidy) {
      return res.status(404).json({ error: '油料补贴不存在' });
    }

    res.json(subsidy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { plot_id, reservation_id, subsidy_amount, fuel_consumption, subsidy_date, status } = req.body;

  if (!plot_id || subsidy_amount === undefined) {
    return res.status(400).json({ error: '地块和补贴金额为必填项' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO oil_subsidies (plot_id, reservation_id, subsidy_amount, fuel_consumption, subsidy_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(plot_id, reservation_id, subsidy_amount, fuel_consumption, subsidy_date, status || 'pending');

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('create', 'oil_subsidy', ?, ?)
    `).run(result.lastInsertRowid, JSON.stringify(req.body));

    res.status(201).json({ id: result.lastInsertRowid, message: '油料补贴创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { plot_id, reservation_id, subsidy_amount, fuel_consumption, subsidy_date, status } = req.body;

  try {
    const result = db.prepare(`
      UPDATE oil_subsidies 
      SET plot_id = ?, reservation_id = ?, subsidy_amount = ?, fuel_consumption = ?, subsidy_date = ?, status = ?
      WHERE id = ?
    `).run(plot_id, reservation_id, subsidy_amount, fuel_consumption, subsidy_date, status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '油料补贴不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('update', 'oil_subsidy', ?, ?)
    `).run(req.params.id, JSON.stringify(req.body));

    res.json({ message: '油料补贴更新成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = db.prepare('DELETE FROM oil_subsidies WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '油料补贴不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('delete', 'oil_subsidy', ?, ?)
    `).run(req.params.id, '油料补贴已删除');

    res.json({ message: '油料补贴删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
