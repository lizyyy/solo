const express = require('express');
const router = express.Router();
const { runQuery, runInsert, runUpdate } = require('./database');
const { recordPackageModification, recordItemModification, recordAppointmentModification } = require('./services/historyService');
const { getExceptions, resolveException, getExceptionStats, createException } = require('./services/exceptionService');
const { generateReport, getReports, exportReportToExcel, getStats } = require('./services/reportService');

router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();
    const exceptionStats = (await getExceptionStats())[0];
    res.json({ ...stats, exceptions: exceptionStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/packages', async (req, res) => {
  try {
    const packages = await runQuery('SELECT * FROM packages ORDER BY created_at DESC');
    for (const pkg of packages) {
      pkg.items = await runQuery(
        'SELECT i.* FROM package_items pi JOIN items i ON pi.item_id = i.id WHERE pi.package_id = ?',
        [pkg.id]
      );
    }
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/packages', async (req, res) => {
  try {
    const { name, description, price, itemIds, createdBy } = req.body;
    const packageId = await runInsert(
      'INSERT INTO packages (name, description, price) VALUES (?, ?, ?)',
      [name, description, price]
    );
    for (const itemId of itemIds || []) {
      await runInsert('INSERT INTO package_items (package_id, item_id) VALUES (?, ?)', [packageId, itemId]);
    }
    res.json({ id: packageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/packages/:id', async (req, res) => {
  try {
    const { name, description, price, status, modifiedBy } = req.body;
    const oldData = (await runQuery('SELECT * FROM packages WHERE id = ?', [req.params.id]))[0];
    await runUpdate(
      'UPDATE packages SET name = ?, description = ?, price = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, price, status, req.params.id]
    );
    const newData = { ...oldData, name, description, price, status };
    await recordPackageModification(req.params.id, oldData, newData, modifiedBy || 'system');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/items', async (req, res) => {
  try {
    const items = await runQuery('SELECT * FROM items ORDER BY created_at DESC');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    const itemId = await runInsert(
      'INSERT INTO items (name, description, price, category) VALUES (?, ?, ?, ?)',
      [name, description, price, category]
    );
    res.json({ id: itemId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:id', async (req, res) => {
  try {
    const { name, description, price, category, modifiedBy } = req.body;
    const oldData = (await runQuery('SELECT * FROM items WHERE id = ?', [req.params.id]))[0];
    await runUpdate(
      'UPDATE items SET name = ?, description = ?, price = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, price, category, req.params.id]
    );
    const newData = { ...oldData, name, description, price, category };
    await recordItemModification(req.params.id, oldData, newData, modifiedBy || 'system');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/item-exclusions', async (req, res) => {
  try {
    const exclusions = await runQuery(`
      SELECT ie.*, i1.name as item1_name, i2.name as item2_name
      FROM item_exclusions ie
      JOIN items i1 ON ie.item1_id = i1.id
      JOIN items i2 ON ie.item2_id = i2.id
      ORDER BY ie.created_at DESC
    `);
    res.json(exclusions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/item-exclusions', async (req, res) => {
  try {
    const { item1Id, item2Id, reason } = req.body;
    await runInsert(
      'INSERT INTO item_exclusions (item1_id, item2_id, reason) VALUES (?, ?, ?)',
      [item1Id, item2Id, reason]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/appointments', async (req, res) => {
  try {
    let sql = `SELECT a.*, p.name as package_name 
               FROM appointments a
               JOIN packages p ON a.package_id = p.id
               WHERE 1=1`;
    const params = [];
    
    if (req.query.userName) {
      sql += ` AND a.user_name LIKE ?`;
      params.push(`%${req.query.userName}%`);
    }
    if (req.query.status) {
      sql += ` AND a.status = ?`;
      params.push(req.query.status);
    }
    if (req.query.startDate) {
      sql += ` AND a.appointment_date >= ?`;
      params.push(req.query.startDate);
    }
    if (req.query.endDate) {
      sql += ` AND a.appointment_date <= ?`;
      params.push(req.query.endDate);
    }
    
    sql += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
    const appointments = await runQuery(sql, params);
    
    for (const apt of appointments) {
      apt.addons = await runQuery(
        `SELECT ao.*, i.name FROM addon_orders ao JOIN items i ON ao.item_id = i.id WHERE ao.appointment_id = ?`,
        [apt.id]
      );
      apt.waivers = await runQuery(
        `SELECT w.*, i.name FROM waivers w JOIN items i ON w.item_id = i.id WHERE w.appointment_id = ?`,
        [apt.id]
      );
    }
    
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/appointments', async (req, res) => {
  try {
    const { userName, userPhone, packageId, appointmentDate, appointmentTime, createdBy } = req.body;
    const appointmentId = await runInsert(
      'INSERT INTO appointments (user_name, user_phone, package_id, appointment_date, appointment_time, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [userName, userPhone, packageId, appointmentDate, appointmentTime, createdBy]
    );
    res.json({ id: appointmentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/appointments/:id', async (req, res) => {
  try {
    const { userName, userPhone, packageId, appointmentDate, appointmentTime, status, modifiedBy } = req.body;
    const oldData = (await runQuery('SELECT * FROM appointments WHERE id = ?', [req.params.id]))[0];
    await runUpdate(
      'UPDATE appointments SET user_name = ?, user_phone = ?, package_id = ?, appointment_date = ?, appointment_time = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userName, userPhone, packageId, appointmentDate, appointmentTime, status, req.params.id]
    );
    const newData = { ...oldData, user_name: userName, user_phone: userPhone, package_id: packageId, appointment_date: appointmentDate, appointment_time: appointmentTime, status };
    await recordAppointmentModification(req.params.id, oldData, newData, modifiedBy || 'system');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/appointments/:id/addons', async (req, res) => {
  try {
    const { itemId, quantity, price, createdBy } = req.body;
    const appointmentId = req.params.id;
    
    const packageItems = await runQuery(
      `SELECT pi.item_id FROM package_items pi JOIN appointments a ON pi.package_id = a.package_id WHERE a.id = ?`,
      [appointmentId]
    );
    const existingAddons = await runQuery(
      'SELECT item_id FROM addon_orders WHERE appointment_id = ? AND status = "confirmed"',
      [appointmentId]
    );
    const currentItems = [...packageItems.map(i => i.item_id), ...existingAddons.map(i => i.item_id)];
    
    const exclusions = await runQuery(
      `SELECT * FROM item_exclusions 
       WHERE (item1_id = ? AND item2_id IN (${currentItems.map(() => '?').join(',')}))
       OR (item2_id = ? AND item1_id IN (${currentItems.map(() => '?').join(',')}))`,
      [itemId, ...currentItems, itemId, ...currentItems]
    );
    
    if (exclusions.length > 0) {
      await createException(
        'item_exclusion',
        appointmentId,
        itemId,
        `项目互斥冲突: 无法添加该项目，与现有项目存在互斥关系`,
        'error'
      );
      return res.status(400).json({ error: '项目存在互斥冲突，无法添加' });
    }
    
    await runInsert(
      'INSERT INTO addon_orders (appointment_id, item_id, quantity, price, created_by, status) VALUES (?, ?, ?, ?, ?, "confirmed")',
      [appointmentId, itemId, quantity, price, createdBy]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/appointments/:id/waivers', async (req, res) => {
  try {
    const { itemId, reason, reasonType, handledBy } = req.body;
    await runInsert(
      'INSERT INTO waivers (appointment_id, item_id, reason, reason_type, handled_by, status) VALUES (?, ?, ?, ?, ?, "approved")',
      [req.params.id, itemId, reason, reasonType, handledBy]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const exceptions = await getExceptions(req.query);
    res.json(exceptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/exceptions/:id/resolve', async (req, res) => {
  try {
    const { handledBy, resolution } = req.body;
    await resolveException(req.params.id, handledBy, resolution);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reports/generate/:appointmentId', async (req, res) => {
  try {
    const { archivedBy } = req.body;
    const report = await generateReport(req.params.appointmentId, archivedBy || 'system');
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const reports = await getReports(req.query);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reports/export', async (req, res) => {
  try {
    const { reportIds } = req.body;
    const buffer = await exportReportToExcel(reportIds);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reports.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/:entityType/:entityId', async (req, res) => {
  try {
    const history = await runQuery(
      'SELECT * FROM modification_history WHERE entity_type = ? AND entity_id = ? ORDER BY modified_at DESC',
      [req.params.entityType, req.params.entityId]
    );
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
