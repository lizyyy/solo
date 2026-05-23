const express = require('express');
const Joi = require('joi');
const db = require('../utils/database');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

const createCheckItemSchema = Joi.object({
  propertyId: Joi.number().allow(null),
  category: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  isRequired: Joi.boolean().default(true),
  sortOrder: Joi.number().default(0)
});

router.get('/', (req, res) => {
  const { propertyId, category, status } = req.query;
  let query = 'SELECT * FROM check_items WHERE 1=1';
  const params = [];

  if (propertyId) {
    query += ' AND (property_id = ? OR property_id IS NULL)';
    params.push(propertyId);
  } else {
    query += ' AND property_id IS NULL';
  }
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  } else {
    query += ' AND status = ?';
    params.push('active');
  }

  query += ' ORDER BY sort_order, name';
  
  const items = db.prepare(query).all(...params);
  res.json({ success: true, data: items });
});

router.get('/categories', (req, res) => {
  const categories = db.prepare(`
    SELECT DISTINCT category 
    FROM check_items 
    WHERE status = 'active'
    ORDER BY category
  `).all();
  
  res.json({ success: true, data: categories.map(c => c.category) });
});

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM check_items WHERE id = ?').get(parseInt(req.params.id));
  if (!item) {
    return res.status(404).json({ success: false, error: '检查项不存在' });
  }
  res.json({ success: true, data: item });
});

router.post('/', (req, res) => {
  const validationResult = validateRequest(createCheckItemSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  const result = db.prepare(`
    INSERT INTO check_items (property_id, category, name, description, is_required, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    value.propertyId || null,
    value.category,
    value.name,
    value.description || '',
    value.isRequired ? 1 : 0,
    value.sortOrder
  );

  const item = db.prepare('SELECT * FROM check_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: item });
});

router.put('/:id', (req, res) => {
  const validationResult = validateRequest(createCheckItemSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM check_items WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '检查项不存在' });
  }

  db.prepare(`
    UPDATE check_items 
    SET property_id = ?, category = ?, name = ?, description = ?, is_required = ?, sort_order = ?, status = ?
    WHERE id = ?
  `).run(
    value.propertyId || null,
    value.category,
    value.name,
    value.description || '',
    value.isRequired ? 1 : 0,
    value.sortOrder,
    existing.status,
    id
  );

  const item = db.prepare('SELECT * FROM check_items WHERE id = ?').get(id);
  res.json({ success: true, data: item });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM check_items WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '检查项不存在' });
  }

  db.prepare('UPDATE check_items SET status = ? WHERE id = ?').run('inactive', id);
  res.json({ success: true, message: '检查项已禁用' });
});

module.exports = router;
