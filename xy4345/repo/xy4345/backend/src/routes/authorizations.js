const express = require('express');
const router = express.Router();
const authorizationModel = require('../models/authorizationModel');
const programModel = require('../models/programModel');

router.get('/', (req, res) => {
  try {
    const authorizations = authorizationModel.getAll();
    res.json(authorizations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/expiring', (req, res) => {
  try {
    const expiring = authorizationModel.checkExpiring();
    res.json(expiring);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/expired', (req, res) => {
  try {
    const expired = authorizationModel.checkExpired();
    res.json(expired);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const authorization = authorizationModel.getById(req.params.id);
    if (!authorization) {
      return res.status(404).json({ error: 'Authorization not found' });
    }
    res.json(authorization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { 
      program_id, material_id, type, holder_name, 
      permission_type, valid_from, valid_until, status, notes 
    } = req.body;
    
    if (!program_id || !type || !holder_name || !permission_type) {
      return res.status(400).json({ error: 'program_id, type, holder_name and permission_type are required' });
    }
    
    const program = programModel.getById(program_id);
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    const authorization = authorizationModel.create({
      program_id,
      material_id,
      type,
      holder_name,
      permission_type,
      valid_from,
      valid_until,
      status,
      notes
    });
    
    res.status(201).json(authorization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const authorization = authorizationModel.getById(req.params.id);
    if (!authorization) {
      return res.status(404).json({ error: 'Authorization not found' });
    }
    
    const updated = authorizationModel.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const authorization = authorizationModel.getById(req.params.id);
    if (!authorization) {
      return res.status(404).json({ error: 'Authorization not found' });
    }
    
    authorizationModel.delete(req.params.id);
    res.json({ message: 'Authorization deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
