const express = require('express');
const router = express.Router();
const moment = require('moment');

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  try {
    const operators = db.prepare(`
      SELECT o.*, 
             COUNT(DISTINCT r.id) as reservation_count
      FROM operators o
      LEFT JOIN reservations r ON o.id = r.operator_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all();

    const enrichedOperators = operators.map(o => ({
      ...o,
      license_expired: o.license_expiry && moment().isAfter(moment(o.license_expiry)),
      license_expiring_soon: o.license_expiry && 
        moment(o.license_expiry).diff(moment(), 'days') < 30 && 
        moment().isBefore(moment(o.license_expiry))
    }));

    res.json(enrichedOperators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const operator = db.prepare(`
      SELECT o.*, 
             COUNT(DISTINCT r.id) as reservation_count
      FROM operators o
      LEFT JOIN reservations r ON o.id = r.operator_id
      WHERE o.id = ?
      GROUP BY o.id
    `).get(req.params.id);

    if (!operator) {
      return res.status(404).json({ error: '机手不存在' });
    }

    const enrichedOperator = {
      ...operator,
      license_expired: operator.license_expiry && moment().isAfter(moment(operator.license_expiry)),
      license_expiring_soon: operator.license_expiry && 
        moment(operator.license_expiry).diff(moment(), 'days') < 30 && 
        moment().isBefore(moment(operator.license_expiry))
    };

    const reservations = db.prepare(`
      SELECT r.*, 
             p.plot_name,
             p.farmer_name,
             m.machine_name,
             (SELECT COUNT(*) FROM risk_assessments ra WHERE ra.reservation_id = r.id AND ra.is_blocked = 1 AND ra.manual_override = 0) as blocked_count
      FROM reservations r
      LEFT JOIN plots p ON r.plot_id = p.id
      LEFT JOIN machines m ON r.machine_id = m.id
      WHERE r.operator_id = ?
      ORDER BY r.start_time DESC
    `).all(req.params.id);

    res.json({ ...enrichedOperator, reservations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { operator_name, id_card, license_type, license_number, license_expiry, phone } = req.body;

  if (!operator_name) {
    return res.status(400).json({ error: '机手姓名为必填项' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO operators (operator_name, id_card, license_type, license_number, license_expiry, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(operator_name, id_card, license_type, license_number, license_expiry, phone);

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('create', 'operator', ?, ?)
    `).run(result.lastInsertRowid, JSON.stringify(req.body));

    res.status(201).json({ id: result.lastInsertRowid, message: '机手创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { operator_name, id_card, license_type, license_number, license_expiry, phone } = req.body;

  try {
    const result = db.prepare(`
      UPDATE operators 
      SET operator_name = ?, id_card = ?, license_type = ?, license_number = ?, license_expiry = ?, phone = ?
      WHERE id = ?
    `).run(operator_name, id_card, license_type, license_number, license_expiry, phone, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '机手不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('update', 'operator', ?, ?)
    `).run(req.params.id, JSON.stringify(req.body));

    res.json({ message: '机手更新成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = db.prepare('DELETE FROM operators WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '机手不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('delete', 'operator', ?, ?)
    `).run(req.params.id, '机手已删除');

    res.json({ message: '机手删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
