const express = require('express');
const { WithdrawalService } = require('../services');

const router = express.Router({ mergeParams: true });

router.post('/', async (req, res) => {
  try {
    const withdrawal = await WithdrawalService.createWithdrawal(
      req.params.applicationId,
      req.body,
      req.headers['x-operator'] || 'api'
    );
    res.status(201).json({ success: true, data: withdrawal });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.post('/:id/start-inspection', async (req, res) => {
  try {
    const withdrawal = await WithdrawalService.startInspection(
      req.params.id,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: withdrawal });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.post('/:id/pass', async (req, res) => {
  try {
    const result = await WithdrawalService.passInspection(
      req.params.id,
      req.body,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.post('/:id/fail', async (req, res) => {
  try {
    const result = await WithdrawalService.failInspection(
      req.params.id,
      req.body,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.post('/:id/reinspect', async (req, res) => {
  try {
    const result = await WithdrawalService.requestReinspection(
      req.params.id,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const withdrawal = await WithdrawalService.getWithdrawal(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, error: '撤场申请不存在' });
    }
    res.json({ success: true, data: withdrawal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const withdrawals = await WithdrawalService.listWithdrawals(req.params.applicationId);
    res.json({ success: true, data: withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
