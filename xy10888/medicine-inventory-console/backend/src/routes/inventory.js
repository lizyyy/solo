const express = require('express');
const router = express.Router();
const Joi = require('joi');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const inventoryService = require('../services/inventoryService');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    const err = new Error('参数验证失败');
    err.name = 'ValidationError';
    err.details = error.details.map(d => d.message);
    return next(err);
  }
  next();
};

const medicineSchema = Joi.object({
  code: Joi.string().required(),
  name: Joi.string().required(),
  specification: Joi.string(),
  manufacturer: Joi.string(),
  unit: Joi.string().required()
});

const sourceSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('HIS', 'WMS', 'DELIVERY', 'OTHER').required(),
  system_code: Joi.string().required(),
  sync_url: Joi.string().uri()
});

const batchSchema = Joi.object({
  medicine_id: Joi.string().required(),
  batch_no: Joi.string().required(),
  production_date: Joi.string().isoDate(),
  expiry_date: Joi.string().isoDate().required(),
  quantity: Joi.number().integer().min(0).required(),
  source_id: Joi.string().required(),
  warehouse_location: Joi.string()
});

const occupySchema = Joi.object({
  batch_id: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  order_no: Joi.string(),
  department: Joi.string(),
  operator: Joi.string().required(),
  reason: Joi.string()
});

const deliverySchema = Joi.object({
  source_id: Joi.string().required(),
  total_quantity: Joi.number().integer().min(1).required()
});

const confirmDeliverySchema = Joi.object({
  items: Joi.array().items(Joi.object({
    medicine_id: Joi.string().required(),
    batch_no: Joi.string().required(),
    planned_quantity: Joi.number().integer().min(0).required(),
    actual_quantity: Joi.number().integer().min(0).required(),
    expiry_date: Joi.string().isoDate().required()
  })).required(),
  operator: Joi.string().required()
});

const resolveDiscrepancySchema = Joi.object({
  resolution: Joi.string().required(),
  resolver: Joi.string().required(),
  remarks: Joi.string()
});

const expiryRuleSchema = Joi.object({
  name: Joi.string().required(),
  warning_days: Joi.number().integer().min(1).required(),
  critical_days: Joi.number().integer().min(1).required(),
  is_default: Joi.boolean()
});

const releaseOccupancySchema = Joi.object({
  operator: Joi.string().required(),
  reason: Joi.string()
});

const syncSchema = Joi.object({
  source_id: Joi.string().required(),
  sync_type: Joi.string().valid('full', 'incremental').required(),
  operator: Joi.string().required()
});

router.get('/statistics', async (req, res, next) => {
  try {
    const stats = await inventoryService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

router.get('/medicines', async (req, res, next) => {
  try {
    const medicines = await inventoryService.listMedicines(req.query);
    res.json({ success: true, data: medicines });
  } catch (err) {
    next(err);
  }
});

router.post('/medicines', validate(medicineSchema), async (req, res, next) => {
  try {
    const medicine = await inventoryService.createMedicine(req.body);
    res.status(201).json({ success: true, data: medicine });
  } catch (err) {
    next(err);
  }
});

router.get('/medicines/:id', async (req, res, next) => {
  try {
    const medicine = await inventoryService.getMedicine(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: '药品不存在' });
    }
    res.json({ success: true, data: medicine });
  } catch (err) {
    next(err);
  }
});

router.get('/sources', async (req, res, next) => {
  try {
    const sources = await inventoryService.listSources();
    res.json({ success: true, data: sources });
  } catch (err) {
    next(err);
  }
});

router.post('/sources', validate(sourceSchema), async (req, res, next) => {
  try {
    const source = await inventoryService.createSource(req.body);
    res.status(201).json({ success: true, data: source });
  } catch (err) {
    next(err);
  }
});

router.get('/batches', async (req, res, next) => {
  try {
    const batches = await inventoryService.listBatches(req.query);
    res.json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
});

router.post('/batches', validate(batchSchema), async (req, res, next) => {
  try {
    const batch = await inventoryService.createBatch(req.body);
    res.status(201).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
});

router.get('/batches/:id', async (req, res, next) => {
  try {
    const batch = await inventoryService.getBatch(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
});

router.post('/batches/occupy', validate(occupySchema), async (req, res, next) => {
  try {
    const occupancy = await inventoryService.occupyBatch(req.body);
    res.json({ success: true, data: occupancy });
  } catch (err) {
    next(err);
  }
});

router.get('/occupancies', async (req, res, next) => {
  try {
    const occupancies = await inventoryService.listOccupancies(req.query);
    res.json({ success: true, data: occupancies });
  } catch (err) {
    next(err);
  }
});

router.get('/occupancies/:id', async (req, res, next) => {
  try {
    const occupancy = await inventoryService.getOccupancy(req.params.id);
    if (!occupancy) {
      return res.status(404).json({ success: false, error: '占用记录不存在' });
    }
    res.json({ success: true, data: occupancy });
  } catch (err) {
    next(err);
  }
});

router.post('/occupancies/:id/release', validate(releaseOccupancySchema), async (req, res, next) => {
  try {
    const occupancy = await inventoryService.releaseOccupancy(
      req.params.id,
      req.body.operator,
      req.body.reason
    );
    res.json({ success: true, data: occupancy });
  } catch (err) {
    next(err);
  }
});

router.get('/deliveries', async (req, res, next) => {
  try {
    const deliveries = await inventoryService.listDeliveries(req.query);
    res.json({ success: true, data: deliveries });
  } catch (err) {
    next(err);
  }
});

router.post('/deliveries', validate(deliverySchema), async (req, res, next) => {
  try {
    const delivery = await inventoryService.createDelivery(req.body);
    res.status(201).json({ success: true, data: delivery });
  } catch (err) {
    next(err);
  }
});

router.get('/deliveries/:id', async (req, res, next) => {
  try {
    const delivery = await inventoryService.getDelivery(req.params.id);
    if (!delivery) {
      return res.status(404).json({ success: false, error: '配送单不存在' });
    }
    res.json({ success: true, data: delivery });
  } catch (err) {
    next(err);
  }
});

router.post('/deliveries/:id/confirm', validate(confirmDeliverySchema), async (req, res, next) => {
  try {
    const delivery = await inventoryService.confirmDelivery(
      req.params.id,
      req.body.items,
      req.body.operator
    );
    res.json({ success: true, data: delivery });
  } catch (err) {
    next(err);
  }
});

router.get('/discrepancies', async (req, res, next) => {
  try {
    const discrepancies = await inventoryService.listDiscrepancies(req.query);
    res.json({ success: true, data: discrepancies });
  } catch (err) {
    next(err);
  }
});

router.get('/discrepancies/:id', async (req, res, next) => {
  try {
    const disc = await inventoryService.getDiscrepancy(req.params.id);
    if (!disc) {
      return res.status(404).json({ success: false, error: '差异单不存在' });
    }
    res.json({ success: true, data: disc });
  } catch (err) {
    next(err);
  }
});

router.post('/discrepancies/:id/resolve', validate(resolveDiscrepancySchema), async (req, res, next) => {
  try {
    const disc = await inventoryService.resolveDiscrepancy(
      req.params.id,
      req.body.resolution,
      req.body.resolver,
      req.body.remarks
    );
    res.json({ success: true, data: disc });
  } catch (err) {
    next(err);
  }
});

router.get('/export/batches', async (req, res, next) => {
  try {
    const data = await inventoryService.exportBatches();
    
    const filename = `inventory_export_${Date.now()}.csv`;
    const filepath = `/tmp/${filename}`;
    
    if (data.length > 0) {
      const csvWriter = createCsvWriter({
        path: filepath,
        header: Object.keys(data[0]).map(key => ({ id: key, title: key }))
      });
      await csvWriter.writeRecords(data);
    }
    
    res.download(filepath, filename, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
});

router.get('/expiry-rules', async (req, res, next) => {
  try {
    const rules = await inventoryService.listExpiryRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
});

router.post('/expiry-rules', validate(expiryRuleSchema), async (req, res, next) => {
  try {
    const rule = await inventoryService.createExpiryRule(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
});

router.post('/sync/execute', validate(syncSchema), async (req, res, next) => {
  try {
    const syncLog = await inventoryService.syncFromSource(
      req.body.source_id,
      req.body.sync_type,
      req.body.operator
    );
    res.json({ success: true, data: syncLog });
  } catch (err) {
    next(err);
  }
});

router.get('/sync/logs', async (req, res, next) => {
  try {
    const logs = await inventoryService.listSyncLogs(req.query);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

router.get('/sync/logs/:id', async (req, res, next) => {
  try {
    const log = await inventoryService.getSyncLog(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, error: '同步日志不存在' });
    }
    res.json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
