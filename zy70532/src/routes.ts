import express from 'express';
import Joi from 'joi';
import {
  createSyncBatch,
  validateSyncBatch,
  getSyncBatch,
  getDepartmentNodes,
  getExceptionNodes,
  startConsumption,
  consumerAck,
  applyManualFix,
  exportSyncReport,
  createConsumerSystem
} from './sync-service';
import { BatchStatus } from './types';

const router = express.Router();

const createBatchSchema = Joi.object({
  source: Joi.string().required(),
  departments: Joi.array().items(
    Joi.object({
      deptId: Joi.string().required(),
      deptName: Joi.string().required(),
      parentDeptId: Joi.string().allow(null).optional(),
      sortOrder: Joi.number().integer().min(0).optional()
    }).unknown(true)
  ).min(1).required(),
  createdBy: Joi.string().required()
});

const manualFixSchema = Joi.object({
  nodeId: Joi.string().required(),
  fixes: Joi.object({
    deptName: Joi.string().optional(),
    parentDeptId: Joi.string().allow(null).optional(),
    sortOrder: Joi.number().integer().min(0).optional()
  }).required(),
  operator: Joi.string().required(),
  remark: Joi.string().required()
});

const consumerAckSchema = Joi.object({
  consumerId: Joi.string().required(),
  success: Joi.boolean().required(),
  errorMessage: Joi.string().optional()
});

const createConsumerSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  callbackUrl: Joi.string().uri().optional()
});

router.post('/batches', async (req, res) => {
  try {
    const { error, value } = createBatchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const batch = await createSyncBatch(value);
    res.status(201).json({
      batchId: batch.id,
      status: batch.status,
      totalNodes: batch.totalNodes
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches/:batchId/validate', async (req, res) => {
  try {
    const result = await validateSyncBatch(req.params.batchId);
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/batches/:batchId', async (req, res) => {
  try {
    const batch = await getSyncBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batches/:batchId/nodes', async (req, res) => {
  try {
    const nodes = await getDepartmentNodes(req.params.batchId);
    res.json(nodes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batches/:batchId/exceptions', async (req, res) => {
  try {
    const exceptions = await getExceptionNodes(req.params.batchId);
    res.json(exceptions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches/:batchId/start', async (req, res) => {
  try {
    await startConsumption(req.params.batchId);
    res.json({ status: BatchStatus.CONSUMING });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/batches/:batchId/ack', async (req, res) => {
  try {
    const { error, value } = consumerAckSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await consumerAck(
      req.params.batchId,
      value.consumerId,
      value.success,
      value.errorMessage
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fixes', async (req, res) => {
  try {
    const { error, value } = manualFixSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await applyManualFix(value);
    res.json({ success: true, message: 'Fix applied, batch ready for revalidation' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/batches/:batchId/export', async (req, res) => {
  try {
    const format = req.query.format as 'json' | 'csv' || 'json';
    const report = await exportSyncReport(req.params.batchId, format);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="sync-report-${req.params.batchId}.json"`);
    }
    res.send(report);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/consumers', async (req, res) => {
  try {
    const { error, value } = createConsumerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const consumerId = await createConsumerSystem(value.name, value.description, value.callbackUrl);
    res.status(201).json({ consumerId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
