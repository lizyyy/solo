const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../middleware');

router.get('/', (req, res) => {
  const { status, risk_level } = req.query;
  let query = 'SELECT * FROM elders WHERE 1=1';
  const params = [];
  const db = getDb();

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (risk_level) {
    query += ' AND risk_level = ?';
    params.push(risk_level);
  }

  const elders = db.prepare(query).all(...params);
  res.json({ success: true, data: elders });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const elder = db.prepare('SELECT * FROM elders WHERE id = ?').get(req.params.id);
  if (!elder) {
    return res.status(404).json({ success: false, error: '老人不存在' });
  }
  res.json({ success: true, data: elder });
});

router.post('/', logOperation('create', 'elder'), (req, res) => {
  const { name, room_number, bed_number, risk_level, medical_conditions, allergies } = req.body;
  const id = uuidv4();
  const db = getDb();

  db.prepare(`
    INSERT INTO elders (id, name, room_number, bed_number, risk_level, medical_conditions, allergies)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, room_number, bed_number, risk_level || 'normal', medical_conditions, allergies);

  if (risk_level === 'high' || risk_level === 'critical') {
    db.prepare(`
      INSERT INTO risk_alerts (id, elder_id, alert_type, message)
      VALUES (?, ?, 'risk_level_change', ?)
    `).run(uuidv4(), id, `新老人${name}风险等级为${risk_level}，请重点关注`);
  }

  const elder = db.prepare('SELECT * FROM elders WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: elder });
});

router.put('/:id', logOperation('update', 'elder'), (req, res) => {
  const db = getDb();
  const elder = db.prepare('SELECT * FROM elders WHERE id = ?').get(req.params.id);
  if (!elder) {
    return res.status(404).json({ success: false, error: '老人不存在' });
  }

  if (elder.status === 'archived') {
    res.locals.blockReason = '已归档的老人档案不能修改';
    return res.status(403).json({ success: false, error: '已归档的老人档案不能修改' });
  }

  const { name, room_number, bed_number, risk_level, medical_conditions, allergies } = req.body;

  db.prepare(`
    UPDATE elders 
    SET name = ?, room_number = ?, bed_number = ?, risk_level = ?, 
        medical_conditions = ?, allergies = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, room_number, bed_number, risk_level, medical_conditions, allergies, req.params.id);

  if (risk_level && risk_level !== elder.risk_level && (risk_level === 'high' || risk_level === 'critical')) {
    db.prepare(`
      INSERT INTO risk_alerts (id, elder_id, alert_type, message)
      VALUES (?, ?, 'risk_level_change', ?)
    `).run(uuidv4(), req.params.id, `老人${name || elder.name}风险等级变更为${risk_level}，请重点关注`);
  }

  const updated = db.prepare('SELECT * FROM elders WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

router.post('/:id/archive', logOperation('archive', 'elder'), (req, res) => {
  const db = getDb();
  const elder = db.prepare('SELECT * FROM elders WHERE id = ?').get(req.params.id);
  if (!elder) {
    return res.status(404).json({ success: false, error: '老人不存在' });
  }

  const pendingItems = db.prepare(`
    SELECT COUNT(*) as count FROM care_items 
    WHERE elder_id = ? AND status IN ('pending', 'in_progress')
  `).get(req.params.id);

  if (pendingItems.count > 0) {
    res.locals.blockReason = '存在未完成的护理事项，无法归档';
    return res.status(409).json({ 
      success: false, 
      error: '存在未完成的护理事项，无法归档',
      pendingItems: pendingItems.count
    });
  }

  db.prepare('UPDATE elders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('archived', req.params.id);

  res.json({ success: true, message: '老人档案已归档' });
});

router.get('/:id/family-notes', (req, res) => {
  const db = getDb();
  const notes = db.prepare(`
    SELECT * FROM family_notes 
    WHERE elder_id = ? 
    ORDER BY created_at DESC
  `).all(req.params.id);

  res.json({ success: true, data: notes });
});

router.post('/:id/family-notes', logOperation('create', 'family_note'), (req, res) => {
  const { author, content, is_important } = req.body;
  const id = uuidv4();
  const db = getDb();

  db.prepare(`
    INSERT INTO family_notes (id, elder_id, author, content, is_important)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.id, author, content, is_important ? 1 : 0);

  const note = db.prepare('SELECT * FROM family_notes WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: note });
});

module.exports = router;
