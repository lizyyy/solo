const express = require('express');
const router = express.Router();
const riskModel = require('../models/riskModel');
const reviewModel = require('../models/reviewModel');

router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let risks;
    if (status) {
      risks = riskModel.getByStatus(status);
    } else {
      risks = riskModel.getAll();
    }
    res.json(risks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = riskModel.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const risk = riskModel.getById(req.params.id);
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    
    const reviews = reviewModel.getByRiskId(req.params.id);
    res.json({
      ...risk,
      reviews
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { program_id, material_id, authorization_id, risk_type, description, severity, status } = req.body;
    
    if (!program_id || !risk_type || !description) {
      return res.status(400).json({ error: 'program_id, risk_type and description are required' });
    }
    
    const risk = riskModel.create({
      program_id,
      material_id,
      authorization_id,
      risk_type,
      description,
      severity,
      status
    });
    
    res.status(201).json(risk);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const risk = riskModel.getById(req.params.id);
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    
    const updated = riskModel.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const risk = riskModel.getById(req.params.id);
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    
    riskModel.delete(req.params.id);
    res.json({ message: 'Risk deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
