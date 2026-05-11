const express = require('express');
const billingService = require('../services/billingService');
const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const result = await billingService.generateBill(
      req.body.houseId,
      req.body.tenantId,
      req.body.billingStart,
      req.body.billingEnd,
      req.body.billType || 'monthly'
    );
    if (!result.success) {
      res.status(400).json(result);
    } else {
      res.json(result);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/generate-monthly', async (req, res) => {
  try {
    const results = await billingService.generateMonthlyBills(
      req.body.houseId,
      req.body.year,
      req.body.month
    );
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/checkout/:tenantId', async (req, res) => {
  try {
    const result = await billingService.generateCheckoutBill(req.params.tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/recalculate/:billId', async (req, res) => {
  try {
    const result = await billingService.recalculateBill(req.params.billId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/tenant/:tenantId', async (req, res) => {
  try {
    const details = await billingService.getTenantBillDetails(req.params.tenantId);
    res.json(details);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/house/:houseId/summary', async (req, res) => {
  try {
    const summary = await billingService.getHouseBillingSummary(
      req.params.houseId,
      req.query.startDate,
      req.query.endDate
    );
    res.json(summary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
