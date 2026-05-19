const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const logger = require('../logger');
const { createAuditLog } = require('../services/auditService');

const router = express.Router();

const partSchema = Joi.object({
  request_id: Joi.string().required(),
  part_code: Joi.string().required(),
  part_name: Joi.string().required(),
  stock_quantity: Joi.number().integer().min(0).default(0),
  unit: Joi.string().required(),
  operator: Joi.string()
});

router.post('/parts', async (req, res) => {
  try {
    const { error, value } = partSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { request_id, part_code, part_name, stock_quantity, unit, operator } = value;

    db.get('SELECT id FROM parts WHERE part_code = ?', [part_code], async (err, existing) => {
      if (err) {
        logger.error('Database error', { error: err.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Part code already exists'
        });
      }

      const id = uuidv4();
      db.run(
        `INSERT INTO parts (id, part_code, part_name, stock_quantity, unit)
         VALUES (?, ?, ?, ?, ?)`,
        [id, part_code, part_name, stock_quantity, unit],
        async (err) => {
          if (err) {
            logger.error('Failed to create part', { error: err.message });
            return res.status(500).json({ success: false, message: 'Failed to create part' });
          }

          await createAuditLog('create', 'part', id, request_id, operator, {
            part_code, part_name, stock_quantity, unit
          });

          logger.info('Part created', { part_code, part_name });
          res.json({
            success: true,
            message: 'Part created successfully',
            data: { id, part_code, part_name, stock_quantity, unit }
          });
        }
      );
    });
  } catch (err) {
    logger.error('Unexpected error', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/parts', (req, res) => {
  const { part_code, part_name, limit = 100 } = req.query;
  
  let query = 'SELECT * FROM parts WHERE 1=1';
  const params = [];
  
  if (part_code) {
    query += ' AND part_code LIKE ?';
    params.push(`%${part_code}%`);
  }
  if (part_name) {
    query += ' AND part_name LIKE ?';
    params.push(`%${part_name}%`);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      logger.error('Failed to get parts', { error: err.message });
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json({ success: true, data: rows });
  });
});

const engineerSchema = Joi.object({
  request_id: Joi.string().required(),
  engineer_code: Joi.string().required(),
  engineer_name: Joi.string().required(),
  phone: Joi.string().allow(''),
  id_card: Joi.string().allow(''),
  operator: Joi.string()
});

router.post('/engineers', async (req, res) => {
  try {
    const { error, value } = engineerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { request_id, engineer_code, engineer_name, phone, id_card, operator } = value;

    db.get('SELECT id FROM engineers WHERE engineer_code = ?', [engineer_code], async (err, existing) => {
      if (err) {
        logger.error('Database error', { error: err.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Engineer code already exists'
        });
      }

      const id = uuidv4();
      db.run(
        `INSERT INTO engineers (id, engineer_code, engineer_name, phone, id_card)
         VALUES (?, ?, ?, ?, ?)`,
        [id, engineer_code, engineer_name, phone, id_card],
        async (err) => {
          if (err) {
            logger.error('Failed to create engineer', { error: err.message });
            return res.status(500).json({ success: false, message: 'Failed to create engineer' });
          }

          await createAuditLog('create', 'engineer', id, request_id, operator, {
            engineer_code
          });

          logger.info('Engineer created', { engineer_code });
          res.json({
            success: true,
            message: 'Engineer created successfully',
            data: { id, engineer_code, engineer_name }
          });
        }
      );
    });
  } catch (err) {
    logger.error('Unexpected error', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/engineers', (req, res) => {
  const { engineer_code, engineer_name, limit = 100 } = req.query;
  
  let query = 'SELECT id, engineer_code, engineer_name, created_at FROM engineers WHERE 1=1';
  const params = [];
  
  if (engineer_code) {
    query += ' AND engineer_code LIKE ?';
    params.push(`%${engineer_code}%`);
  }
  if (engineer_name) {
    query += ' AND engineer_name LIKE ?';
    params.push(`%${engineer_name}%`);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      logger.error('Failed to get engineers', { error: err.message });
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json({ success: true, data: rows });
  });
});

module.exports = router;
