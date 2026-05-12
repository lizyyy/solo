const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');
const service = require('../services/registrationService');

router.get('/', (req, res) => {
  const residents = db.prepare('SELECT * FROM residents ORDER BY created_at DESC').all();
  res.json({ success: true, data: residents });
});

router.get('/:id', (req, res) => {
  const resident = service.getResidentWithFamily(req.params.id);
  if (!resident) return res.status(404).json({ success: false, error: '居民不存在' });
  res.json({ success: true, data: resident });
});

router.get('/:id/report', (req, res) => {
  const report = service.getFamilyReport(req.params.id);
  if (!report.success) return res.status(404).json(report);
  
  if (req.query.export === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename=resident-${req.params.id}-report.json`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(report, null, 2));
  }
  
  res.json(report);
});

router.post('/', (req, res) => {
  const { name, id_card, birth_date, gender, phone, address } = req.body;
  
  if (!name || !birth_date) {
    return res.status(400).json({ success: false, error: '缺少必要字段：name, birth_date' });
  }
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO residents (id, name, id_card, birth_date, gender, phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    stmt.run(id, name, id_card || null, birth_date, gender || null, phone || null, address || null);
  } catch (e) {
    if (e.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: '身份证号已存在' });
    }
    throw e;
  }
  
  const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: resident, message: '居民档案创建成功' });
});

router.post('/:id/family', (req, res) => {
  const residentId = req.params.id;
  const { name, relation, birth_date, gender, phone } = req.body;
  
  if (!name || !relation || !birth_date) {
    return res.status(400).json({ success: false, error: '缺少必要字段：name, relation, birth_date' });
  }
  
  const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(residentId);
  if (!resident) return res.status(404).json({ success: false, error: '居民不存在' });
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO family_members (id, resident_id, name, relation, birth_date, gender, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, residentId, name, relation, birth_date, gender || null, phone || null);
  
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: member, message: '家庭成员添加成功' });
});

router.get('/:id/family', (req, res) => {
  const members = db.prepare('SELECT * FROM family_members WHERE resident_id = ?').all(req.params.id);
  res.json({ success: true, data: members });
});

module.exports = router;
