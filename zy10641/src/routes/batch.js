const express = require('express');
const Joi = require('joi');
const BatchService = require('../services/BatchService');
const ExportService = require('../services/ExportService');

const router = express.Router();

const listSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('syncing', 'failed', 'replaying', 'completed'),
  dataSource: Joi.string(),
  batchNo: Joi.string(),
  startDate: Joi.string(),
  endDate: Joi.string()
});

const createSchema = Joi.object({
  batchNo: Joi.string(),
  dataSource: Joi.string().required(),
  targetTable: Joi.string().required(),
  totalCount: Joi.number().integer().min(0).default(0),
  successCount: Joi.number().integer().min(0).default(0),
  failCount: Joi.number().integer().min(0).default(0),
  failReason: Joi.string(),
  failDetail: Joi.any(),
  createdBy: Joi.string()
});

const replaySchema = Joi.object({
  operator: Joi.string().required(),
  reason: Joi.string().default('')
});

const completeReplaySchema = Joi.object({
  successCount: Joi.number().integer().min(0).default(0),
  failCount: Joi.number().integer().min(0).default(0),
  conflictCount: Joi.number().integer().min(0).default(0),
  skipCount: Joi.number().integer().min(0).default(0),
  failRecords: Joi.array().default([]),
  conflictRecords: Joi.array().default([]),
  evidence: Joi.object().default({})
});

const exportSchema = Joi.object({
  exportType: Joi.string().valid('batch_list', 'replay_history', 'fail_records').required(),
  operator: Joi.string().required(),
  filters: Joi.object().default({})
});

router.get('/', async (req, res) => {
  try {
    const { error, value } = listSchema.validate(req.query);
    if (error) {
      return res.error(error.details[0].message, 400);
    }

    const result = await BatchService.list(value);
    res.success(result, '查询成功');
  } catch (err) {
    res.error(err.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await BatchService.getDetail(req.params.id);
    res.success(result, '查询成功');
  } catch (err) {
    res.error(err.message, 404);
  }
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      return res.error(error.details[0].message, 400);
    }

    const batch = await BatchService.create(value);
    res.success(BatchService.formatBatch(batch), '创建成功');
  } catch (err) {
    res.error(err.message, 500);
  }
});

router.post('/:id/mark-failed', async (req, res) => {
  try {
    const batch = await BatchService.markFailed(req.params.id, req.body);
    res.success(BatchService.formatBatch(batch), '标记失败成功');
  } catch (err) {
    res.error(err.message, 500);
  }
});

router.post('/:id/replay', async (req, res) => {
  try {
    const { error, value } = replaySchema.validate(req.body);
    if (error) {
      return res.error(error.details[0].message, 400);
    }

    const result = await BatchService.replay(req.params.id, value.operator, value.reason);
    res.success(result, '重放任务已提交');
  } catch (err) {
    res.error(err.message, 500);
  }
});

router.post('/:id/complete-replay', async (req, res) => {
  try {
    const { error, value } = completeReplaySchema.validate(req.body);
    if (error) {
      return res.error(error.details[0].message, 400);
    }

    const result = await BatchService.completeReplay(req.params.id, value);
    res.success(result, '重放完成');
  } catch (err) {
    res.error(err.message, 500);
  }
});

router.post('/:id/check-conflict', async (req, res) => {
  try {
    const { recordKeys = [] } = req.body;
    const result = await BatchService.checkConflict(req.params.id, recordKeys);
    res.success(result, '冲突检测完成');
  } catch (err) {
    res.error(err.message, 500);
  }
});

router.post('/export', async (req, res) => {
  try {
    const { error, value } = exportSchema.validate(req.body);
    if (error) {
      return res.error(error.details[0].message, 400);
    }

    const result = await ExportService.createExportRequest(
      value.exportType,
      value.filters,
      value.operator
    );
    res.success(result, '导出任务已提交');
  } catch (err) {
    res.error(err.message, 500);
  }
});

router.get('/export/:id/status', async (req, res) => {
  try {
    const result = await ExportService.getExportStatus(req.params.id);
    res.success(result, '查询成功');
  } catch (err) {
    res.error(err.message, 404);
  }
});

module.exports = router;
