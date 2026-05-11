const express = require('express');
const router = express.Router();
const settlementService = require('../services/settlementService');
const utils = require('../utils');

router.post('/settle/:period', async (req, res) => {
  try {
    const result = await settlementService.settlePeriod(req.params.period);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/confirm', async (req, res) => {
  try {
    const { member_id, period } = req.body;
    if (!member_id || !period) {
      return res.status(400).json({ error: '会员ID和周期不能为空' });
    }
    const result = await settlementService.confirmSettlement(
      member_id,
      period,
      req.headers['x-operator'] || 'operator'
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/recalculate/:period', async (req, res) => {
  try {
    const force = req.query.force === 'true' || req.body.force === true;
    const result = await settlementService.recalculatePeriod(
      req.params.period,
      force,
      req.headers['x-operator'] || 'operator'
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/statistics/:period', async (req, res) => {
  try {
    const stats = await settlementService.getSettlementStatistics(req.params.period);
    res.json({
      period: req.params.period,
      statistics: stats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/:period', async (req, res) => {
  try {
    const history = await settlementService.getSettlementHistory(req.params.period);
    res.json({
      period: req.params.period,
      settlement_runs: history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/critical/:period', async (req, res) => {
  try {
    const thresholdPercent = parseFloat(req.query.threshold) || 0.9;
    const critical = await settlementService.getCriticalMembers(
      req.params.period,
      thresholdPercent
    );
    res.json({
      period: req.params.period,
      threshold_percent: thresholdPercent,
      critical_members: critical
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/member/:member_id', async (req, res) => {
  try {
    const settlements = await settlementService.getMemberSettlements(req.params.member_id);
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/current-period', async (req, res) => {
  try {
    res.json({ current_period: utils.getPeriod() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
