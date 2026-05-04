const express = require('express');
const router = express.Router();
const Evaluation = require('../models/Evaluation');
const ContextPackage = require('../models/ContextPackage');
const TokenStrategy = require('../models/TokenStrategy');
const tokenService = require('../services/tokenService');

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const riskLevel = req.query.riskLevel;
    
    let evaluations;
    if (riskLevel) {
      evaluations = Evaluation.findByRiskLevel(riskLevel, limit, offset);
    } else {
      evaluations = Evaluation.findAll(limit, offset);
    }
    
    res.json({
      success: true,
      data: evaluations.map(e => e.toJSON())
    });
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/run', async (req, res) => {
  try {
    const { contextPackageId, strategyId, notes } = req.body;
    
    if (!contextPackageId) {
      return res.status(400).json({
        success: false,
        error: 'contextPackageId is required'
      });
    }
    
    const contextPackage = ContextPackage.findById(contextPackageId);
    if (!contextPackage) {
      return res.status(404).json({
        success: false,
        error: 'Context package not found'
      });
    }
    
    let strategy;
    if (strategyId) {
      strategy = TokenStrategy.findById(strategyId);
      if (!strategy) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found'
        });
      }
    } else {
      strategy = TokenStrategy.findDefault();
      if (!strategy) {
        return res.status(500).json({
          success: false,
          error: 'No default strategy available'
        });
      }
    }
    
    const contextData = contextPackage.toContextData();
    
    const result = tokenService.applyTokenBudget(contextData, {
      maxTokens: strategy.maxTokens,
      priorityRules: strategy.priorityRules
    });
    
    const evaluation = Evaluation.create({
      contextPackageId: contextPackage.id,
      strategyId: strategy.id,
      result,
      notes: notes || ''
    });
    
    res.status(201).json({
      success: true,
      data: {
        evaluation: evaluation.toJSON(),
        strategy: strategy.toJSON()
      }
    });
  } catch (error) {
    console.error('Error running evaluation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/run/dry', async (req, res) => {
  try {
    const { contextPackageId, strategyId, maxTokens, priorityRules } = req.body;
    
    let strategy;
    if (strategyId) {
      strategy = TokenStrategy.findById(strategyId);
    }
    
    const effectiveMaxTokens = maxTokens || strategy?.maxTokens || 4096;
    const effectivePriorityRules = priorityRules || strategy?.priorityRules || {};
    
    let contextData;
    
    if (contextPackageId) {
      const contextPackage = ContextPackage.findById(contextPackageId);
      if (!contextPackage) {
        return res.status(404).json({
          success: false,
          error: 'Context package not found'
        });
      }
      contextData = contextPackage.toContextData();
    } else {
      const { conversations, docs, toolResults, budget } = req.body;
      contextData = {
        conversations: conversations || [],
        docs: docs || '',
        toolResults: toolResults || null,
        budgetConstraints: budget || {}
      };
    }
    
    const result = tokenService.applyTokenBudget(contextData, {
      maxTokens: effectiveMaxTokens,
      priorityRules: effectivePriorityRules
    });
    
    res.json({
      success: true,
      data: {
        result,
        strategy: {
          maxTokens: effectiveMaxTokens,
          priorityRules: effectivePriorityRules
        }
      }
    });
  } catch (error) {
    console.error('Error running dry evaluation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/compare', async (req, res) => {
  try {
    const { contextPackageId, strategyIds } = req.body;
    
    if (!contextPackageId) {
      return res.status(400).json({
        success: false,
        error: 'contextPackageId is required'
      });
    }
    
    if (!strategyIds || !Array.isArray(strategyIds) || strategyIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 strategyIds are required for comparison'
      });
    }
    
    const contextPackage = ContextPackage.findById(contextPackageId);
    if (!contextPackage) {
      return res.status(404).json({
        success: false,
        error: 'Context package not found'
      });
    }
    
    const contextData = contextPackage.toContextData();
    const comparisons = [];
    
    for (const strategyId of strategyIds) {
      const strategy = TokenStrategy.findById(strategyId);
      if (!strategy) {
        continue;
      }
      
      const result = tokenService.applyTokenBudget(contextData, {
        maxTokens: strategy.maxTokens,
        priorityRules: strategy.priorityRules
      });
      
      comparisons.push({
        strategy: strategy.toJSON(),
        result
      });
    }
    
    res.json({
      success: true,
      data: {
        contextPackageId,
        originalTokens: contextPackage.totalTokens,
        comparisons
      }
    });
  } catch (error) {
    console.error('Error running comparison:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const evaluation = Evaluation.findById(id);
    
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }
    
    res.json({
      success: true,
      data: evaluation.toJSON()
    });
  } catch (error) {
    console.error('Error fetching evaluation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { riskLevel, notes } = req.body;
    
    const evaluation = Evaluation.findById(id);
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }
    
    evaluation.update({ riskLevel, notes });
    
    res.json({
      success: true,
      data: evaluation.toJSON()
    });
  } catch (error) {
    console.error('Error updating evaluation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const evaluation = Evaluation.findById(id);
    
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }
    
    evaluation.delete();
    
    res.json({
      success: true,
      message: 'Evaluation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting evaluation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
