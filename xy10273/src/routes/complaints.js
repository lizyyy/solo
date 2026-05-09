const express = require('express');
const router = express.Router();
const Joi = require('joi');
const {
  createComplaint,
  getComplaintById,
  getComplaints,
  advanceComplaintStatus,
  updateComplaint,
  createTraceReport,
  getReportById,
  getReportsByComplaint,
  completeReport,
  getFullTraceInfo,
  COMPLAINT_STATUS,
  REPORT_STATUS
} = require('../services/complaintService');

const createComplaintSchema = Joi.object({
  activityId: Joi.string().optional(),
  sampleArchiveId: Joi.string().optional(),
  complaintType: Joi.string().required(),
  complaintDate: Joi.string().required(),
  complaintContent: Joi.string().required(),
  complainant: Joi.string().required(),
  contactInfo: Joi.string().optional()
});

const updateComplaintSchema = Joi.object({
  complaintType: Joi.string().optional(),
  complaintContent: Joi.string().optional(),
  contactInfo: Joi.string().optional()
});

const complaintStatusSchema = Joi.object({
  targetStatus: Joi.string().valid(...Object.values(COMPLAINT_STATUS)).required(),
  resolution: Joi.string().optional()
});

const createReportSchema = Joi.object({
  reportContent: Joi.string().required(),
  reportDate: Joi.string().required(),
  activityId: Joi.string().optional()
});

const completeReportSchema = Joi.object({
  conclusion: Joi.string().required()
});

router.post('/complaints', async (req, res) => {
  const { error } = createComplaintSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await createComplaint(req.body, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(400).json(result);
    }
    if (result.isDuplicate) {
      return res.status(200).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('创建投诉失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/complaints', async (req, res) => {
  try {
    const filters = {
      activityId: req.query.activityId,
      status: req.query.status,
      complaintDateFrom: req.query.complaintDateFrom
    };
    const complaints = await getComplaints(filters);
    res.json({ success: true, data: complaints });
  } catch (err) {
    console.error('查询投诉列表失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/complaints/:id', async (req, res) => {
  try {
    const complaint = await getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: '投诉记录不存在', code: 'NOT_FOUND' });
    }
    res.json({ success: true, data: complaint });
  } catch (err) {
    console.error('查询投诉失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/complaints/:id/trace', async (req, res) => {
  try {
    const result = await getFullTraceInfo(req.params.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('查询追溯信息失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.put('/complaints/:id', async (req, res) => {
  const { error } = updateComplaintSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await updateComplaint(req.params.id, req.body, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'READONLY_STATUS') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('更新投诉失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/complaints/:id/advance', async (req, res) => {
  const { error } = complaintStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await advanceComplaintStatus(
      req.params.id,
      req.body.targetStatus,
      requestId,
      operator,
      req.body.resolution
    );
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'INVALID_STATUS' || result.code === 'INVALID_TRANSITION') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('推进投诉状态失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/complaints/:complaintId/reports', async (req, res) => {
  const { error } = createReportSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await createTraceReport(req.params.complaintId, req.body, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.isDuplicate) {
      return res.status(200).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('创建追溯报告失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/complaints/:complaintId/reports', async (req, res) => {
  try {
    const reports = await getReportsByComplaint(req.params.complaintId);
    res.json({ success: true, data: reports });
  } catch (err) {
    console.error('查询报告列表失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/reports/:id', async (req, res) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: '追溯报告不存在', code: 'NOT_FOUND' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    console.error('查询报告失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/reports/:id/complete', async (req, res) => {
  const { error } = completeReportSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await completeReport(req.params.id, req.body.conclusion, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'ALREADY_COMPLETED') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('完成报告失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
