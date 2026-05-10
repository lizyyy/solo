const express = require('express');
const RemediationService = require('../services/remediation.service');
const { ValidationError } = require('../utils/error-handler');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { employeeId, documentId, ...data } = req.body;
    if (!employeeId || !documentId) {
      throw new ValidationError('员工ID和资料ID是必填项');
    }
    
    const task = RemediationService.createTask(
      employeeId,
      documentId,
      data,
      req.headers['x-user-id'] || 'system'
    );
    res.status(201).json(task);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/bulk', (req, res) => {
  try {
    const { employeeId, documentIds, ...data } = req.body;
    if (!employeeId || !documentIds || !Array.isArray(documentIds)) {
      throw new ValidationError('员工ID和资料ID列表是必填项');
    }
    
    const results = RemediationService.createBulkTasks(
      employeeId,
      documentIds,
      data,
      req.headers['x-user-id'] || 'system'
    );
    res.json(results);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const tasks = RemediationService.getAllTasks(req.query);
    res.json(tasks);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/employee/:employeeId', (req, res) => {
  try {
    const tasks = RemediationService.getEmployeeTasks(req.params.employeeId, req.query);
    res.json(tasks);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const task = RemediationService.getTask(req.params.id);
    res.json(task);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/:id/start', (req, res) => {
  try {
    const task = RemediationService.startTask(
      req.params.id,
      req.headers['x-user-id'] || 'system'
    );
    res.json(task);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const task = RemediationService.completeTask(
      req.params.id,
      req.body || {},
      req.headers['x-user-id'] || 'system'
    );
    res.json(task);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    if (!req.body.reason) {
      throw new ValidationError('取消原因是必填项');
    }
    
    const task = RemediationService.cancelTask(
      req.params.id,
      req.body.reason,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(task);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/check/:employeeId', (req, res) => {
  try {
    const results = RemediationService.checkAndCreateTasksForMissingDocuments(
      req.params.employeeId,
      req.headers['x-user-id'] || 'system'
    );
    res.json(results);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
