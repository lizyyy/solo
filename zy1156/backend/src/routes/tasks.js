const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const ContextPackage = require('../models/ContextPackage');
const Evaluation = require('../models/Evaluation');

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const tasks = Task.findAll(limit, offset);
    const total = Task.count();
    
    res.json({
      success: true,
      data: {
        tasks: tasks.map(t => t.toJSON()),
        pagination: {
          total,
          limit,
          offset
        }
      }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Task name is required'
      });
    }
    
    const task = Task.create({
      name: name.trim(),
      description: description || ''
    });
    
    res.status(201).json({
      success: true,
      data: task.toJSON()
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = Task.findById(id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    const contextPackages = ContextPackage.findByTaskId(id, 20, 0);
    const evaluations = [];
    
    for (const cp of contextPackages) {
      const evals = Evaluation.findByContextPackageId(cp.id, 10, 0);
      evaluations.push(...evals);
    }
    
    res.json({
      success: true,
      data: {
        task: task.toJSON(),
        contextPackages: contextPackages.map(cp => cp.toJSON()),
        evaluations: evaluations.map(e => e.toJSON())
      }
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    const task = Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    task.update({ name, description, status });
    
    res.json({
      success: true,
      data: task.toJSON()
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = Task.findById(id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    const contextPackages = ContextPackage.findByTaskId(id);
    for (const cp of contextPackages) {
      const evaluations = Evaluation.findByContextPackageId(cp.id);
      for (const e of evaluations) {
        e.delete();
      }
      cp.delete();
    }
    
    task.delete();
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
