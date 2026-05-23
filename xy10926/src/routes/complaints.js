const express = require('express');
const Joi = require('joi');
const db = require('../utils/database');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

const createComplaintSchema = Joi.object({
  taskId: Joi.number().allow(null),
  propertyId: Joi.number().required(),
  complaintDate: Joi.string().required(),
  complainant: Joi.string().allow(''),
  category: Joi.string().allow(''),
  description: Joi.string().required(),
  relatedCheckItems: Joi.string().allow(''),
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').default('open')
});

const handleComplaintSchema = Joi.object({
  status: Joi.string().valid('in_progress', 'resolved', 'closed').required(),
  handledBy: Joi.string().required(),
  resolution: Joi.string().required()
});

router.get('/', (req, res) => {
  const { propertyId, status, startDate, endDate } = req.query;
  let query = `
    SELECT cr.*, p.name as property_name, ct.task_date, ct.cleaner_name
    FROM complaint_records cr
    LEFT JOIN properties p ON cr.property_id = p.id
    LEFT JOIN cleaning_tasks ct ON cr.task_id = ct.id
    WHERE 1=1
  `;
  const params = [];

  if (propertyId) {
    query += ' AND cr.property_id = ?';
    params.push(propertyId);
  }
  if (status) {
    query += ' AND cr.status = ?';
    params.push(status);
  }
  if (startDate) {
    query += ' AND cr.complaint_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND cr.complaint_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY cr.complaint_date DESC, cr.id DESC';

  const complaints = db.prepare(query).all(...params);
  res.json({ success: true, data: complaints });
});

router.get('/:id', (req, res) => {
  const complaint = db.prepare(`
    SELECT cr.*, p.name as property_name, ct.task_date, ct.cleaner_name
    FROM complaint_records cr
    LEFT JOIN properties p ON cr.property_id = p.id
    LEFT JOIN cleaning_tasks ct ON cr.task_id = ct.id
    WHERE cr.id = ?
  `).get(parseInt(req.params.id));
  
  if (!complaint) {
    return res.status(404).json({ success: false, error: '客诉记录不存在' });
  }
  res.json({ success: true, data: complaint });
});

router.post('/', (req, res) => {
  const validationResult = validateRequest(createComplaintSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  const result = db.prepare(`
    INSERT INTO complaint_records (task_id, property_id, complaint_date, complainant, category, description, related_check_items, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.taskId || null,
    value.propertyId,
    value.complaintDate,
    value.complainant || '',
    value.category || '',
    value.description,
    value.relatedCheckItems || '',
    value.status
  );

  const complaint = db.prepare('SELECT * FROM complaint_records WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: complaint });
});

router.put('/:id/handle', (req, res) => {
  const validationResult = validateRequest(handleComplaintSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM complaint_records WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '客诉记录不存在' });
  }

  db.prepare(`
    UPDATE complaint_records 
    SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP, resolution = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(value.status, value.handledBy, value.resolution, id);

  const complaint = db.prepare('SELECT * FROM complaint_records WHERE id = ?').get(id);
  res.json({ success: true, data: complaint });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM complaint_records WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '客诉记录不存在' });
  }

  db.prepare('UPDATE complaint_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('closed', id);
  res.json({ success: true, message: '客诉记录已关闭' });
});

module.exports = router;
