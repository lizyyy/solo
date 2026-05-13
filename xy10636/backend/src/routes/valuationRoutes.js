const express = require('express');
const router = express.Router();
const ValuationService = require('../services/valuationService');
const { Parser } = require('json2csv');

router.get('/', async (req, res) => {
  try {
    const filters = req.query;
    const valuations = await ValuationService.getValuations(filters);
    res.json({ success: true, data: valuations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await ValuationService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const anomalies = await ValuationService.getAnomalyList();
    res.json({ success: true, data: anomalies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/operators', async (req, res) => {
  try {
    const operators = await ValuationService.getOperators();
    res.json({ success: true, data: operators });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/brands', async (req, res) => {
  try {
    const brands = await ValuationService.getBrands();
    res.json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const valuation = await ValuationService.getValuationById(req.params.id);
    if (!valuation) {
      return res.status(404).json({ success: false, message: '估价单不存在' });
    }
    res.json({ success: true, data: valuation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/flow-records', async (req, res) => {
  try {
    const records = await ValuationService.getFlowRecords(req.params.id);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/change-history', async (req, res) => {
  try {
    const history = await ValuationService.getChangeHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await ValuationService.createValuation(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message.includes('DUPLICATE_SUBMISSION')) {
      return res.status(400).json({ success: false, message: error.message, code: 'DUPLICATE_SUBMISSION' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/onsite-valuation', async (req, res) => {
  try {
    const result = await ValuationService.updateOnsiteValuation(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message.includes('PRICE_CHANGE_REASON_REQUIRED')) {
      return res.status(400).json({ success: false, message: error.message, code: 'PRICE_CHANGE_REASON_REQUIRED' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/cancel', async (req, res) => {
  try {
    const result = await ValuationService.cancelValuation(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/review-cancellation', async (req, res) => {
  try {
    const result = await ValuationService.reviewCancellation(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/export/report', async (req, res) => {
  try {
    const filters = req.query;
    const data = await ValuationService.exportReport(filters);

    const fields = [
      'order_no', 'customer_name', 'customer_phone', 'appliance_brand',
      'appliance_model', 'appliance_type', 'purchase_year', 'online_valuation',
      'onsite_valuation', 'final_price', 'status', 'operator', 'reviewer',
      'is_anomaly', 'anomaly_type', 'created_at'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment(`valuation_report_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
