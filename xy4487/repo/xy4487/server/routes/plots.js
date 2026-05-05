const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  try {
    const plots = db.prepare(`
      SELECT p.*, 
             COUNT(DISTINCT r.id) as reservation_count,
             SUM(os.subsidy_amount) as total_subsidy
      FROM plots p
      LEFT JOIN reservations r ON p.id = r.plot_id
      LEFT JOIN oil_subsidies os ON p.id = os.plot_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(plots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const plot = db.prepare(`
      SELECT p.*, 
             COUNT(DISTINCT r.id) as reservation_count,
             SUM(os.subsidy_amount) as total_subsidy
      FROM plots p
      LEFT JOIN reservations r ON p.id = r.plot_id
      LEFT JOIN oil_subsidies os ON p.id = os.plot_id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(req.params.id);

    if (!plot) {
      return res.status(404).json({ error: '地块不存在' });
    }

    const reservations = db.prepare(`
      SELECT r.*, 
             m.machine_name,
             o.operator_name,
             (SELECT COUNT(*) FROM risk_assessments ra WHERE ra.reservation_id = r.id AND ra.is_blocked = 1 AND ra.manual_override = 0) as blocked_count
      FROM reservations r
      LEFT JOIN machines m ON r.machine_id = m.id
      LEFT JOIN operators o ON r.operator_id = o.id
      WHERE r.plot_id = ?
      ORDER BY r.start_time DESC
    `).all(req.params.id);

    const subsidies = db.prepare(`
      SELECT * FROM oil_subsidies WHERE plot_id = ? ORDER BY subsidy_date DESC
    `).all(req.params.id);

    res.json({ ...plot, reservations, subsidies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { farmer_name, plot_name, area, location, crop_type } = req.body;

  if (!farmer_name || !plot_name || !area) {
    return res.status(400).json({ error: '农户姓名、地块名称和面积为必填项' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO plots (farmer_name, plot_name, area, location, crop_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(farmer_name, plot_name, area, location, crop_type);

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('create', 'plot', ?, ?)
    `).run(result.lastInsertRowid, JSON.stringify(req.body));

    res.status(201).json({ id: result.lastInsertRowid, message: '地块创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { farmer_name, plot_name, area, location, crop_type } = req.body;

  try {
    const result = db.prepare(`
      UPDATE plots 
      SET farmer_name = ?, plot_name = ?, area = ?, location = ?, crop_type = ?
      WHERE id = ?
    `).run(farmer_name, plot_name, area, location, crop_type, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '地块不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('update', 'plot', ?, ?)
    `).run(req.params.id, JSON.stringify(req.body));

    res.json({ message: '地块更新成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = db.prepare('DELETE FROM plots WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '地块不存在' });
    }

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('delete', 'plot', ?, ?)
    `).run(req.params.id, '地块已删除');

    res.json({ message: '地块删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
