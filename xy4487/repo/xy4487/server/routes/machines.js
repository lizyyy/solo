const express = require('express');
const router = express.Router();
const moment = require('moment');

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  try {
    const machines = db.prepare(`
      SELECT m.*, 
             COUNT(DISTINCT r.id) as reservation_count,
             (julianday('now') - julianday(m.last_maintenance)) as days_since_maintenance
      FROM machines m
      LEFT JOIN reservations r ON m.id = r.machine_id
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `).all();

    const enrichedMachines = machines.map(m => ({
      ...m,
      maintenance_overdue: m.last_maintenance && 
        (moment().diff(moment(m.last_maintenance), 'days') > m.maintenance_interval_days),
      maintenance_warning: m.last_maintenance && 
        (moment().diff(moment(m.last_maintenance), 'days') > m.maintenance_interval_days - 7)
    }));

    res.json(enrichedMachines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const machine = db.prepare(`
      SELECT m.*, 
             COUNT(DISTINCT r.id) as reservation_count
      FROM machines m
      LEFT JOIN reservations r ON m.id = r.machine_id
      WHERE m.id = ?
      GROUP BY m.id
    `).get(req.params.id);

    if (!machine) {
      return res.status(404).json({ error: '机具不存在' });
    }

    const enrichedMachine = {
      ...machine,
      maintenance_overdue: machine.last_maintenance && 
        (moment().diff(moment(machine.last_maintenance), 'days') > machine.maintenance_interval_days),
      maintenance_warning: machine.last_maintenance && 
        (moment().diff(moment(machine.last_maintenance), 'days') > machine.maintenance_interval_days - 7)
    };

    const reservations = db.prepare(`
      SELECT r.*, 
             p.plot_name,
             p.farmer_name,
             o.operator_name,
             (SELECT COUNT(*) FROM risk_assessments ra WHERE ra.reservation_id = r.id AND ra.is_blocked = 1 AND ra.manual_override = 0) as blocked_count
      FROM reservations r
      LEFT JOIN plots p ON r.plot_id = p.id
      LEFT JOIN operators o ON r.operator_id = o.id
      WHERE r.machine_id = ?
      ORDER BY r.start_time DESC
    `).all(req.params.id);

    res.json({ ...enrichedMachine, reservations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status } = req.body;

  if (!machine_name) {
    return res.status(400).json({ error: '机具名称为必填项' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO machines (machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days || 90, status || 'active');

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('create', 'machine', ?, ?)
    `).run(result.lastInsertRowid, JSON.stringify(req.body));

    res.status(201).json({ id: result.lastInsertRowid, message: '机具创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status } = req.body;

  try {
    const result = db.prepare(`
      UPDATE machines 
      SET machine_name = ?, machine_type = ?, license_plate = ?, last_maintenance = ?, maintenance_interval_days = ?, status = ?
      WHERE id = ?
    `).run(machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '机具不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('update', 'machine', ?, ?)
    `).run(req.params.id, JSON.stringify(req.body));

    res.json({ message: '机具更新成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = db.prepare('DELETE FROM machines WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '机具不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('delete', 'machine', ?, ?)
    `).run(req.params.id, '机具已删除');

    res.json({ message: '机具删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
