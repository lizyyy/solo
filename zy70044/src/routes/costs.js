const express = require('express');
const router = express.Router();
const costService = require('../services/cost-service');
const exportService = require('../services/export-service');
const { formatDate } = require('../utils');

router.post('/add', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { repair_order_id, responsibility, cost_type, amount, currency, description } = req.body;
    
    if (!repair_order_id) {
      return res.status(400).json({ success: false, error: '返修单ID不能为空' });
    }

    const result = costService.addCost(repair_order_id, {
      responsibility,
      cost_type,
      amount,
      currency,
      description
    }, operator);

    res.status(201).json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/', (req, res) => {
  try {
    const filter = {
      repair_order_id: req.query.repair_order_id,
      responsibility: req.query.responsibility,
      is_settled: req.query.is_settled !== undefined ? req.query.is_settled === 'true' : undefined,
      settlement_batch: req.query.settlement_batch,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };
    const costs = costService.listCosts(filter);
    res.json({ success: true, data: costs });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/unsettled', (req, res) => {
  try {
    const unsettled = costService.getUnsettledCostsByResponsibility();
    res.json({ success: true, data: unsettled });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/export', (req, res) => {
  try {
    const filter = {
      repair_order_id: req.query.repair_order_id,
      responsibility: req.query.responsibility,
      is_settled: req.query.is_settled !== undefined ? req.query.is_settled === 'true' : undefined,
      settlement_batch: req.query.settlement_batch,
      limit: 10000,
      offset: 0
    };
    const costs = costService.listCosts(filter);
    const csv = exportService.exportCostsToCSV(costs);
    const filename = `费用记录_${formatDate(Date.now()).replace(/[/:]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/settlement/batch', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { responsibility } = req.body;
    
    if (!responsibility) {
      return res.status(400).json({ success: false, error: '责任方不能为空' });
    }

    const batch = costService.createSettlementBatch(responsibility, operator);
    res.status(201).json({ success: true, data: batch });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/settlement/batches', (req, res) => {
  try {
    const filter = {
      responsibility: req.query.responsibility,
      status: req.query.status,
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0
    };
    const batches = costService.listSettlementBatches(filter);
    res.json({ success: true, data: batches });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/settlement/batches/:id', (req, res) => {
  try {
    const batch = costService.getSettlementBatch(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '结算批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/settlement/batches/:id/export', (req, res) => {
  try {
    const batch = costService.getSettlementBatch(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '结算批次不存在' });
    }
    const csv = exportService.exportSettlementToCSV(batch);
    const filename = `结算单_${formatDate(Date.now()).replace(/[/:]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/settlement/batches/:id/confirm', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const result = costService.confirmSettlementBatch(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
