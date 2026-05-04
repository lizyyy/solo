const express = require('express');
const Joi = require('joi');
const rateLimitService = require('../services/rateLimitService');
const reportService = require('../services/reportService');
const db = require('../database');

const router = express.Router();

const checkRequestSchema = Joi.object({
  appKey: Joi.string().required(),
  path: Joi.string().required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').default('GET'),
  timestamp: Joi.number().integer().positive()
});

const simulateConcurrentSchema = Joi.object({
  appKey: Joi.string().required(),
  path: Joi.string().required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').default('GET'),
  requestCount: Joi.number().integer().positive().max(10000).default(100),
  algorithm: Joi.string().valid('fixed-window', 'sliding-window')
});

const simulateTimelineSchema = Joi.object({
  appKey: Joi.string().required(),
  path: Joi.string().required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').default('GET'),
  timestamps: Joi.array().items(Joi.number().integer().positive()).required(),
  algorithm: Joi.string().valid('fixed-window', 'sliding-window')
});

const statsSchema = Joi.object({
  startTime: Joi.number().integer().positive(),
  endTime: Joi.number().integer().positive()
});

const boundaryAnalysisSchema = Joi.object({
  appKey: Joi.string().required(),
  path: Joi.string().required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').default('GET'),
  windowSeconds: Joi.number().integer().positive().default(60),
  testDurationSeconds: Joi.number().integer().positive().default(10)
});

const reportSchema = Joi.object({
  startTime: Joi.number().integer().positive(),
  endTime: Joi.number().integer().positive(),
  format: Joi.string().valid('markdown', 'json').default('markdown'),
  includeBoundaryAnalysis: Joi.boolean().default(false),
  appKey: Joi.string(),
  path: Joi.string(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
  windowSeconds: Joi.number().integer().positive()
});

router.post('/check', async (req, res) => {
  try {
    const { error, value } = checkRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { appKey, path, method, timestamp } = value;
    const result = await rateLimitService.checkRateLimit(
      appKey, 
      path, 
      method, 
      timestamp || Date.now()
    );

    res.json(result);
  } catch (err) {
    console.error('Check rate limit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/simulate/concurrent', async (req, res) => {
  try {
    const { error, value } = simulateConcurrentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { appKey, path, method, requestCount, algorithm } = value;
    const result = await rateLimitService.simulateConcurrentRequests(
      appKey, 
      path, 
      method, 
      requestCount,
      algorithm
    );

    res.json(result);
  } catch (err) {
    console.error('Simulate concurrent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/simulate/timeline', async (req, res) => {
  try {
    const { error, value } = simulateTimelineSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { appKey, path, method, timestamps, algorithm } = value;
    const result = await rateLimitService.simulateTimeline(
      appKey, 
      path, 
      method, 
      timestamps,
      algorithm
    );

    res.json(result);
  } catch (err) {
    console.error('Simulate timeline error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { error, value } = statsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const endTime = value.endTime || Date.now();
    const startTime = value.startTime || (endTime - 24 * 60 * 60 * 1000);
    const stats = rateLimitService.getStatistics(startTime, endTime);

    res.json(stats);
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/boundary-analysis', async (req, res) => {
  try {
    const { error, value } = boundaryAnalysisSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { appKey, path, method, windowSeconds, testDurationSeconds } = value;
    const analysis = rateLimitService.analyzeBoundaryMisallows(
      appKey, 
      path, 
      method, 
      windowSeconds, 
      testDurationSeconds
    );

    if (analysis.error) {
      return res.status(400).json(analysis);
    }

    res.json(analysis);
  } catch (err) {
    console.error('Boundary analysis error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/report', async (req, res) => {
  try {
    const { error, value } = reportSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const endTime = value.endTime || Date.now();
    const startTime = value.startTime || (endTime - 24 * 60 * 60 * 1000);
    const stats = rateLimitService.getStatistics(startTime, endTime);

    let boundaryAnalysis = null;
    if (value.includeBoundaryAnalysis && value.appKey && value.path) {
      boundaryAnalysis = rateLimitService.analyzeBoundaryMisallows(
        value.appKey,
        value.path,
        value.method || 'GET',
        value.windowSeconds || 60
      );
    }

    if (value.format === 'json') {
      const jsonReport = reportService.generateJSONReport(stats, boundaryAnalysis);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="rate-limit-report.json"');
      res.send(jsonReport);
    } else {
      const markdownReport = reportService.generateMarkdownReport(stats, boundaryAnalysis);
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="rate-limit-report.md"');
      res.send(markdownReport);
    }
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const endTime = req.query.endTime ? parseInt(req.query.endTime) : Date.now();
    const startTime = req.query.startTime ? parseInt(req.query.startTime) : (endTime - 24 * 60 * 60 * 1000);
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;

    const logs = await reportService.getDetailedLogs(startTime, endTime, limit);
    res.json(logs);
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/logs', async (req, res) => {
  try {
    const appKey = req.query.appKey;
    const path = req.query.path;

    let appKeyId = null;
    let routeId = null;

    if (appKey) {
      const appKeyRecord = db.get('SELECT id FROM app_keys WHERE app_key = ?', [appKey]);
      if (!appKeyRecord) {
        return res.status(400).json({ error: 'App key not found' });
      }
      appKeyId = appKeyRecord.id;
    }

    if (path) {
      const routeRecord = db.get('SELECT id FROM routes WHERE path = ?', [path]);
      if (!routeRecord) {
        return res.status(400).json({ error: 'Route not found' });
      }
      routeId = routeRecord.id;
    }

    const result = rateLimitService.clearLogs(appKeyId, routeId);
    res.json(result);
  } catch (err) {
    console.error('Clear logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
