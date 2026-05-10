const express = require('express');
const AuditService = require('../services/audit.service');
const { BackgroundJobService, jobExecutors } = require('../services/background-job.service');
const { ValidationError } = require('../utils/error-handler');

const router = express.Router();

router.get('/logs', (req, res) => {
  try {
    const logs = AuditService.getLogs(req.query.entityType, req.query.entityId);
    res.json(logs);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/employee/:employeeId', (req, res) => {
  try {
    const logs = AuditService.getEmployeeHistory(req.params.employeeId);
    res.json(logs);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/status-changes/:employeeId', (req, res) => {
  try {
    const changes = AuditService.getStatusChanges(req.params.employeeId);
    res.json(changes);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/jobs', (req, res) => {
  try {
    const { jobType, payload, ...options } = req.body;
    if (!jobType || !payload) {
      throw new ValidationError('任务类型和负载是必填项');
    }
    
    const job = BackgroundJobService.createJob(jobType, payload, options);
    res.status(201).json(job);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/jobs', (req, res) => {
  try {
    const jobs = BackgroundJobService.getPendingJobs();
    res.json(jobs);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/jobs/:id', (req, res) => {
  try {
    const status = BackgroundJobService.getJobStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/jobs/:id/execute', (req, res) => {
  try {
    const job = BackgroundJobService.getJob(req.params.id);
    const executor = jobExecutors[job.jobType];
    
    if (!executor) {
      throw new ValidationError(`未知的任务类型: ${job.jobType}`);
    }
    
    const result = BackgroundJobService.executeJob(req.params.id, executor);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/jobs/:id/retry', (req, res) => {
  try {
    const result = BackgroundJobService.retryJob(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/jobs/:id/cancel', (req, res) => {
  try {
    if (!req.body.reason) {
      throw new ValidationError('取消原因是必填项');
    }
    
    const result = BackgroundJobService.cancelJob(
      req.params.id,
      req.body.reason,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
