const express = require('express');
const router = express.Router();
const moment = require('moment');

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  try {
    const { status, date_from, date_to } = req.query;
    
    let query = `
      SELECT r.*, 
             p.plot_name,
             p.farmer_name,
             p.area as plot_area,
             m.machine_name,
             m.license_plate,
             o.operator_name,
             o.license_expiry,
             (SELECT COUNT(*) FROM risk_assessments ra WHERE ra.reservation_id = r.id AND ra.is_blocked = 1 AND ra.manual_override = 0) as blocked_count,
             (SELECT COUNT(*) FROM risk_assessments ra WHERE ra.reservation_id = r.id AND ra.is_blocked = 1 AND ra.manual_override = 1) as override_count
      FROM reservations r
      LEFT JOIN plots p ON r.plot_id = p.id
      LEFT JOIN machines m ON r.machine_id = m.id
      LEFT JOIN operators o ON r.operator_id = o.id
    `;
    
    const conditions = [];
    const params = [];
    
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    
    if (date_from) {
      conditions.push('date(r.start_time) >= ?');
      params.push(date_from);
    }
    
    if (date_to) {
      conditions.push('date(r.start_time) <= ?');
      params.push(date_to);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY r.start_time DESC';

    const reservations = db.prepare(query).all(...params);
    
    const enrichedReservations = reservations.map(r => ({
      ...r,
      can_proceed: r.blocked_count === 0 || r.override_count > 0,
      has_overrides: r.override_count > 0
    }));

    res.json(enrichedReservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const reservation = db.prepare(`
      SELECT r.*, 
             p.plot_name,
             p.farmer_name,
             p.area as plot_area,
             m.machine_name,
             m.license_plate,
             m.last_maintenance,
             m.maintenance_interval_days,
             o.operator_name,
             o.license_expiry,
             o.license_type
      FROM reservations r
      LEFT JOIN plots p ON r.plot_id = p.id
      LEFT JOIN machines m ON r.machine_id = m.id
      LEFT JOIN operators o ON r.operator_id = o.id
      WHERE r.id = ?
    `).get(req.params.id);

    if (!reservation) {
      return res.status(404).json({ error: '预约不存在' });
    }

    const riskAssessments = db.prepare(`
      SELECT * FROM risk_assessments WHERE reservation_id = ? ORDER BY created_at DESC
    `).all(req.params.id);

    const subsidy = db.prepare(`
      SELECT * FROM oil_subsidies WHERE reservation_id = ?
    `).get(req.params.id);

    res.json({ ...reservation, riskAssessments, subsidy });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { plot_id, machine_id, operator_id, start_time, end_time, work_type } = req.body;

  if (!plot_id || !machine_id || !start_time || !end_time) {
    return res.status(400).json({ error: '地块、机具、开始时间和结束时间为必填项' });
  }

  const transaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO reservations (plot_id, machine_id, operator_id, start_time, end_time, work_type, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(plot_id, machine_id, operator_id, start_time, end_time, work_type);

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('create', 'reservation', ?, ?)
    `).run(result.lastInsertRowid, JSON.stringify(req.body));

    return result.lastInsertRowid;
  });

  try {
    const reservationId = transaction();
    res.status(201).json({ id: reservationId, message: '预约创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { plot_id, machine_id, operator_id, start_time, end_time, work_type, status } = req.body;

  const transaction = db.transaction(() => {
    const result = db.prepare(`
      UPDATE reservations 
      SET plot_id = ?, machine_id = ?, operator_id = ?, start_time = ?, end_time = ?, work_type = ?, status = ?
      WHERE id = ?
    `).run(plot_id, machine_id, operator_id, start_time, end_time, work_type, status, req.params.id);

    if (result.changes === 0) {
      throw new Error('预约不存在');
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('update', 'reservation', ?, ?)
    `).run(req.params.id, JSON.stringify(req.body));
  });

  try {
    transaction();
    res.json({ message: '预约更新成功' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.put('/:id/status', (req, res) => {
  const db = req.app.locals.db;
  const { status } = req.body;

  try {
    const result = db.prepare(`
      UPDATE reservations SET status = ? WHERE id = ?
    `).run(status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '预约不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('status_change', 'reservation', ?, ?)
    `).run(req.params.id, JSON.stringify({ status }));

    res.json({ message: '状态更新成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = db.prepare('DELETE FROM reservations WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '预约不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('delete', 'reservation', ?, ?)
    `).run(req.params.id, '预约已删除');

    res.json({ message: '预约删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
