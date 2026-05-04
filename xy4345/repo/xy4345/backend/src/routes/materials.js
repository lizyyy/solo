const express = require('express');
const router = express.Router();
const materialModel = require('../models/materialModel');
const programModel = require('../models/programModel');

router.get('/', (req, res) => {
  try {
    const materials = materialModel.getAll();
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/duplicates', (req, res) => {
  try {
    const duplicates = materialModel.findDuplicates();
    res.json(duplicates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const material = materialModel.getById(req.params.id);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    res.json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { program_id, type, name, source, duration, metadata } = req.body;
    
    if (!program_id || !type || !name) {
      return res.status(400).json({ error: 'program_id, type and name are required' });
    }
    
    const program = programModel.getById(program_id);
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    const material = materialModel.create({
      program_id,
      type,
      name,
      source,
      duration,
      metadata
    });
    
    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const material = materialModel.getById(req.params.id);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    const updated = materialModel.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const material = materialModel.getById(req.params.id);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    materialModel.delete(req.params.id);
    res.json({ message: 'Material deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
