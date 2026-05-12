import express from 'express';
import { issueVoucher, bindPassenger, redeemVoucher, refundVoucher, getQuota } from '../services/voucherService.js';
import { reconcile, getReconciliationDetails } from '../services/reconciliationService.js';

const router = express.Router();

router.post('/issue', async (req, res) => {
  try {
    const result = await issueVoucher(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/bind', async (req, res) => {
  try {
    const result = await bindPassenger(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/redeem', async (req, res) => {
  try {
    const result = await redeemVoucher(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/refund', async (req, res) => {
  try {
    const result = await refundVoucher(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/quota/:corporateId', async (req, res) => {
  try {
    const result = await getQuota(req.params.corporateId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reconcile/:sourceId', async (req, res) => {
  try {
    const { startDate, endDate, externalData } = req.body;
    const result = await reconcile(req.params.sourceId, startDate, endDate, externalData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reconcile/:sourceId/details', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await getReconciliationDetails(req.params.sourceId, startDate, endDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;