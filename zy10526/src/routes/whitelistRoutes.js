const express = require('express');
const router = express.Router();
const Joi = require('joi');
const whitelistService = require('../services/whitelistService');
const exportService = require('../services/exportService');

const createWhitelistSchema = Joi.object({
  accountId: Joi.string().required(),
  whitelistTypeCode: Joi.string().required(),
  ruleCode: Joi.string().required(),
  sourceCode: Joi.string().required(),
  effectiveDate: Joi.date().optional(),
  expiryDate: Joi.date().optional(),
  remark: Joi.string().optional(),
  operator: Joi.string().optional()
});

const statusUpdateSchema = Joi.object({
  status: Joi.string().valid('pending', 'active', 'expired', 'revoked', 'manual_corrected').required(),
  operator: Joi.string().optional()
});

const manualCorrectSchema = Joi.object({
  effectiveDate: Joi.date().optional(),
  expiryDate: Joi.date().optional(),
  remark: Joi.string().optional(),
  reason: Joi.string().required(),
  operator: Joi.string().optional()
});

const hitRecordSchema = Joi.object({
  hitScene: Joi.string().required(),
  requestContext: Joi.object().optional(),
  hitResult: Joi.string().valid('passed', 'blocked', 'review').default('passed'),
  operator: Joi.string().optional()
});

const reportSchema = Joi.object({
  whitelistId: Joi.string().uuid().optional(),
  hitRecordId: Joi.string().uuid().optional(),
  reportType: Joi.string().valid('single_hit', 'customer_summary', 'exception_analysis', 'manual_correction').default('customer_summary'),
  operator: Joi.string().optional()
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = createWhitelistSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await whitelistService.createWhitelist(value, value.operator);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await whitelistService.getWhitelist(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: '白名单不存在' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await whitelistService.queryWhitelists(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { error, value } = statusUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await whitelistService.advanceStatus(req.params.id, value.status, value.operator);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:id/correct', async (req, res) => {
  try {
    const { error, value } = manualCorrectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await whitelistService.manualCorrect(req.params.id, value, value.operator);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:id/hit', async (req, res) => {
  try {
    const { error, value } = hitRecordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await whitelistService.recordHit(
      req.params.id, 
      value.hitScene, 
      value.requestContext, 
      value.hitResult, 
      value.operator
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/reports/:customerId', async (req, res) => {
  try {
    const { error, value } = reportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await whitelistService.generateExplanationReport(req.params.customerId, value);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/reports/:id', async (req, res) => {
  try {
    const { ExplanationReport, Customer, CustomerWhitelist, HitRecord } = require('../models');
    const report = await ExplanationReport.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: CustomerWhitelist, as: 'customerWhitelist' },
        { model: HitRecord, as: 'hitRecord' }
      ]
    });
    
    if (!report) {
      return res.status(404).json({ success: false, message: '报告不存在' });
    }
    
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/exceptions/list', async (req, res) => {
  try {
    const result = await whitelistService.getExceptions(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/exceptions/:id/resolve', async (req, res) => {
  try {
    const { resolutionNote, resolvedBy } = req.body;
    if (!resolutionNote) {
      return res.status(400).json({ success: false, message: '解决说明不能为空' });
    }

    const result = await whitelistService.resolveException(req.params.id, resolutionNote, resolvedBy);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/export/whitelists', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const result = await exportService.exportWhitelists(req.query, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=whitelists_${Date.now()}.csv`);
      return res.send(result);
    }
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/export/hits', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const result = await exportService.exportHitRecords(req.query, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=hit_records_${Date.now()}.csv`);
      return res.send(result);
    }
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/export/exceptions', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const result = await exportService.exportExceptions(req.query, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=exceptions_${Date.now()}.csv`);
      return res.send(result);
    }
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
