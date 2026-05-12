const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const maintenanceService = require('../services/maintenanceService');

router.use(express.json());

const handleResponse = (res, result) => {
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
};

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/assets', (req, res) => {
  const result = maintenanceService.createAsset(req.body);
  res.status(201).json({ success: true, data: result });
});

router.get('/assets', (req, res) => {
  handleResponse(res, maintenanceService.listAssets());
});

router.get('/assets/:id', (req, res) => {
  const asset = maintenanceService.getAsset(req.params.id);
  if (asset) {
    res.json({ success: true, data: asset });
  } else {
    res.status(404).json({ success: false, error: '资产不存在', code: 'ASSET_NOT_FOUND' });
  }
});

router.get('/assets/:id/history', (req, res) => {
  handleResponse(res, maintenanceService.getAssetHistory(req.params.id));
});

router.post('/vendors', (req, res) => {
  const result = maintenanceService.createVendor(req.body);
  res.status(201).json({ success: true, data: result });
});

router.get('/vendors', (req, res) => {
  handleResponse(res, maintenanceService.listVendors());
});

router.get('/vendors/:id', (req, res) => {
  const vendor = maintenanceService.getVendor(req.params.id);
  if (vendor) {
    res.json({ success: true, data: vendor });
  } else {
    res.status(404).json({ success: false, error: '维保商不存在', code: 'VENDOR_NOT_FOUND' });
  }
});

router.post('/repairs/submit', (req, res) => {
  handleResponse(res, maintenanceService.submitRepair(req.body));
});

router.post('/repairs/:id/assign', (req, res) => {
  handleResponse(res, maintenanceService.assignVendor({
    order_id: req.params.id,
    ...req.body
  }));
});

router.post('/repairs/:id/quote', (req, res) => {
  handleResponse(res, maintenanceService.submitQuote({
    order_id: req.params.id,
    ...req.body
  }));
});

router.post('/quotes/:id/approve', (req, res) => {
  handleResponse(res, maintenanceService.approveQuote({
    quote_id: req.params.id,
    ...req.body
  }));
});

router.post('/quotes/:id/reject', (req, res) => {
  handleResponse(res, maintenanceService.rejectQuote({
    quote_id: req.params.id,
    ...req.body
  }));
});

router.post('/repairs/:id/complete', (req, res) => {
  handleResponse(res, maintenanceService.completeWork({
    order_id: req.params.id,
    ...req.body
  }));
});

router.post('/repairs/:id/expense', (req, res) => {
  handleResponse(res, maintenanceService.updateExpense({
    order_id: req.params.id,
    ...req.body
  }));
});

router.post('/repairs/:id/evaluate', (req, res) => {
  handleResponse(res, maintenanceService.evaluate({
    order_id: req.params.id,
    ...req.body
  }));
});

router.post('/escalation/check', (req, res) => {
  handleResponse(res, maintenanceService.checkEscalation());
});

router.get('/repairs/:id', (req, res) => {
  handleResponse(res, maintenanceService.getOrderDetail(req.params.id));
});

router.get('/repairs', (req, res) => {
  const filters = {
    status: req.query.status,
    asset_id: req.query.asset_id,
    vendor_id: req.query.vendor_id,
    start_date: req.query.start_date,
    end_date: req.query.end_date,
    keyword: req.query.keyword
  };
  handleResponse(res, maintenanceService.searchOrders(filters));
});

router.get('/reports/:type', (req, res) => {
  const params = {
    start_date: req.query.start_date,
    end_date: req.query.end_date
  };
  
  const result = maintenanceService.generateReport(req.params.type, params);
  handleResponse(res, result);
});

router.get('/reports/:type/export', (req, res) => {
  const result = maintenanceService.generateReport(req.params.type, {
    start_date: req.query.start_date,
    end_date: req.query.end_date
  });

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  let data = result.data;
  if (!Array.isArray(data)) {
    data = [data];
  }

  try {
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=report_${req.params.type}_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: '导出失败', details: error.message });
  }
});

module.exports = router;
