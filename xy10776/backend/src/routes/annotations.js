const express = require('express');
const Joi = require('joi');
const AnnotationModel = require('../models/Annotation');
const router = express.Router();

const createSchema = Joi.object({
  request_id: Joi.string(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  event_type: Joi.string().valid('bug', 'feature', 'marketing', 'operation', 'incident').required(),
  event_date: Joi.string().required(),
  impact_level: Joi.string().valid('low', 'medium', 'high', 'critical'),
  created_by: Joi.string().required(),
  scopes: Joi.array().items(Joi.object({
    scope_type: Joi.string().valid('chart', 'metric', 'dimension', 'date_range', 'global').required(),
    scope_value: Joi.string().required()
  }))
});

const transitionSchema = Joi.object({
  status: Joi.string().valid('draft', 'pending_approval', 'approved', 'rejected', 'published', 'revoked', 'archived', 'cancelled', 'recalled', 'correction_pending').required(),
  approver: Joi.string(),
  comment: Joi.string(),
  updated_by: Joi.string().required()
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const annotation = await AnnotationModel.create(value);
    res.json(annotation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      event_type: req.query.event_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0
    };

    const annotations = await AnnotationModel.list(filters);
    res.json(annotations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const annotation = await AnnotationModel.getById(req.params.id);
    if (!annotation) {
      return res.status(404).json({ error: '注释事件不存在' });
    }
    res.json(annotation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { error, value } = transitionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const annotation = await AnnotationModel.transitionStatus(
      req.params.id,
      value.status,
      value.approver,
      value.comment,
      value.updated_by
    );

    res.json(annotation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const db = require('../database/db');
    db.all('SELECT * FROM versions WHERE annotation_id = ? ORDER BY version_number DESC', [req.params.id], (err, rows) => {
      if (err) throw err;
      res.json(rows);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/replay/:version', async (req, res) => {
  try {
    const result = await AnnotationModel.replayVersion(
      req.params.id,
      parseInt(req.params.version),
      req.body.replayed_by || 'system'
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const db = require('../database/db');
    db.all(`
      SELECT * FROM approval_status_logs 
      WHERE annotation_id = ? 
      ORDER BY created_at ASC
    `, [req.params.id], (err, rows) => {
      if (err) throw err;
      res.json(rows);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
