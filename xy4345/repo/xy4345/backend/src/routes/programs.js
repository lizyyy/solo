const express = require('express');
const router = express.Router();
const programModel = require('../models/programModel');
const materialModel = require('../models/materialModel');
const authorizationModel = require('../models/authorizationModel');
const riskModel = require('../models/riskModel');

router.get('/', (req, res) => {
  try {
    const programs = programModel.getAll();
    res.json(programs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const program = programModel.getById(req.params.id);
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    const materials = materialModel.getByProgramId(req.params.id);
    const authorizations = authorizationModel.getByProgramId(req.params.id);
    const risks = riskModel.getByProgramId(req.params.id);
    
    res.json({
      ...program,
      materials,
      authorizations,
      risks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, episode_number, title, status } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const program = programModel.create({
      name,
      episode_number,
      title,
      status
    });
    
    res.status(201).json(program);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const program = programModel.getById(req.params.id);
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    const updated = programModel.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const program = programModel.getById(req.params.id);
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    programModel.delete(req.params.id);
    res.json({ message: 'Program deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
