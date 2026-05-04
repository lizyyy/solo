const express = require('express');
const router = express.Router();
const TokenStrategy = require('../models/TokenStrategy');

router.get('/', async (req, res) => {
  try {
    const strategies = TokenStrategy.findAll();
    
    res.json({
      success: true,
      data: strategies.map(s => s.toJSON())
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/default', async (req, res) => {
  try {
    const strategy = TokenStrategy.findDefault();
    
    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'No default strategy found'
      });
    }
    
    res.json({
      success: true,
      data: strategy.toJSON()
    });
  } catch (error) {
    console.error('Error fetching default strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, maxTokens, priorityRules, isDefault } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Strategy name is required'
      });
    }
    
    if (!maxTokens || maxTokens <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid maxTokens is required'
      });
    }
    
    const strategy = TokenStrategy.create({
      name: name.trim(),
      description: description || '',
      maxTokens: parseInt(maxTokens),
      priorityRules: priorityRules || {},
      isDefault: isDefault || false
    });
    
    res.status(201).json({
      success: true,
      data: strategy.toJSON()
    });
  } catch (error) {
    console.error('Error creating strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = TokenStrategy.findById(id);
    
    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found'
      });
    }
    
    res.json({
      success: true,
      data: strategy.toJSON()
    });
  } catch (error) {
    console.error('Error fetching strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, maxTokens, priorityRules, isDefault } = req.body;
    
    const strategy = TokenStrategy.findById(id);
    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found'
      });
    }
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (maxTokens !== undefined) updates.maxTokens = parseInt(maxTokens);
    if (priorityRules !== undefined) updates.priorityRules = priorityRules;
    if (isDefault !== undefined) updates.isDefault = isDefault;
    
    strategy.update(updates);
    
    res.json({
      success: true,
      data: strategy.toJSON()
    });
  } catch (error) {
    console.error('Error updating strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = TokenStrategy.findById(id);
    
    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found'
      });
    }
    
    strategy.delete();
    
    res.json({
      success: true,
      message: 'Strategy deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
