const express = require('express');
const Joi = require('joi');
const db = require('../utils/database');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

const createPropertySchema = Joi.object({
  name: Joi.string().required(),
  address: Joi.string().required(),
  roomCount: Joi.number().default(1),
  status: Joi.string().valid('active', 'inactive').default('active')
});

router.get('/', (req, res) => {
  const status = req.query.status;
  let query = 'SELECT * FROM properties';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const properties = db.prepare(query).all(...params);
  res.json({ success: true, data: properties });
});

router.get('/:id', (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(parseInt(req.params.id));
  if (!property) {
    return res.status(404).json({ success: false, error: '房源不存在' });
  }
  res.json({ success: true, data: property });
});

router.post('/', (req, res) => {
  const validationResult = validateRequest(createPropertySchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  const result = db.prepare(`
    INSERT INTO properties (name, address, room_count, status)
    VALUES (?, ?, ?, ?)
  `).run(value.name, value.address, value.roomCount, value.status);

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: property });
});

router.put('/:id', (req, res) => {
  const validationResult = validateRequest(createPropertySchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '房源不存在' });
  }

  db.prepare(`
    UPDATE properties 
    SET name = ?, address = ?, room_count = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(value.name, value.address, value.roomCount, value.status, id);

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  res.json({ success: true, data: property });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '房源不存在' });
  }

  db.prepare('UPDATE properties SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('inactive', id);
  res.json({ success: true, message: '房源已禁用' });
});

module.exports = router;
