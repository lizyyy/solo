const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const router = express.Router();

router.post('/', (req, res) => {
  const { name, code, description, max_payout } = req.body;
  
  if (!name || !code || max_payout === undefined) {
    return res.status(400).json({
      error: '缺少必要字段',
      required: ['name', 'code', 'max_payout']
    });
  }

  const existing = db.prepare('SELECT * FROM insurance_types WHERE code = ?').get(code);
  if (existing) {
    return res.status(409).json({
      error: '险种代码已存在',
      code
    });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO insurance_types (id, name, code, description, max_payout)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, code, description, max_payout);

  const insuranceType = db.prepare('SELECT * FROM insurance_types WHERE id = ?').get(id);
  res.status(201).json(insuranceType);
});

router.get('/', (req, res) => {
  const types = db.prepare('SELECT * FROM insurance_types').all();
  res.json(types);
});

router.get('/:id', (req, res) => {
  const insuranceType = db.prepare('SELECT * FROM insurance_types WHERE id = ?').get(req.params.id);
  if (!insuranceType) {
    return res.status(404).json({ error: '险种不存在' });
  }
  res.json(insuranceType);
});

router.post('/:id/material-requirements', (req, res) => {
  const insuranceType = db.prepare('SELECT * FROM insurance_types WHERE id = ?').get(req.params.id);
  if (!insuranceType) {
    return res.status(404).json({ error: '险种不存在' });
  }

  const { material_code, material_name, is_required, validity_days, description } = req.body;
  
  if (!material_code || !material_name) {
    return res.status(400).json({
      error: '缺少必要字段',
      required: ['material_code', 'material_name']
    });
  }

  const existing = db.prepare(`
    SELECT * FROM material_requirements 
    WHERE insurance_type_id = ? AND material_code = ?
  `).get(req.params.id, material_code);

  if (existing) {
    return res.status(409).json({
      error: '该险种下已存在相同材料代码的要求',
      material_code
    });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO material_requirements 
    (id, insurance_type_id, material_code, material_name, is_required, validity_days, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, material_code, material_name, is_required ?? 1, validity_days, description);

  const requirement = db.prepare('SELECT * FROM material_requirements WHERE id = ?').get(id);
  res.status(201).json(requirement);
});

router.get('/:id/material-requirements', (req, res) => {
  const insuranceType = db.prepare('SELECT * FROM insurance_types WHERE id = ?').get(req.params.id);
  if (!insuranceType) {
    return res.status(404).json({ error: '险种不存在' });
  }

  const requirements = db.prepare(`
    SELECT * FROM material_requirements WHERE insurance_type_id = ?
  `).all(req.params.id);

  res.json({
    insurance_type: insuranceType,
    requirements
  });
});

module.exports = router;
