const express = require('express');
const router = express.Router();
const exceptionService = require('../services/exceptionService');
const taskService = require('../services/taskService');

router.get('/exceptions', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const exceptions = exceptionService.getExceptions(limit);
    
    res.json({
      success: true,
      data: exceptions
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

router.get('/exceptions/unresolved', (req, res) => {
  try {
    const exceptions = exceptionService.getUnresolvedExceptions();
    
    res.json({
      success: true,
      data: exceptions
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

router.post('/exceptions/:id/resolve', (req, res) => {
  try {
    const exceptionId = parseInt(req.params.id);
    const { resolved_by, note } = req.body;
    
    if (!resolved_by) {
      return res.status(400).json({
        success: false,
        error: 'resolved_by is required'
      });
    }
    
    exceptionService.resolveException(exceptionId, parseInt(resolved_by), note);
    
    res.json({
      success: true,
      data: { exceptionId, resolved: true }
    });
  } catch (e) {
    if (e.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: e.message
      });
    }
    res.status(400).json({
      success: false,
      error: e.message
    });
  }
});

router.get('/tasks', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const tasks = taskService.getTasks(limit);
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

router.get('/tasks/pending', (req, res) => {
  try {
    const tasks = taskService.getPendingTasks();
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;
