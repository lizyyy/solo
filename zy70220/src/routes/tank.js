const express = require('express');
const router = express.Router();
const waterTankService = require('../services/waterTankService');
const { getHistoryByEntity } = require('../utils/history');
const { handleError } = require('../utils/errors');
const config = require('../config');

router.get('/status', (req, res) => {
  try {
    const status = waterTankService.getTankStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/supply', (req, res) => {
  try {
    const { amount, reason, operator } = req.body;
    const result = waterTankService.supplyWater(
      amount,
      reason,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.get('/history', (req, res) => {
  try {
    const history = getHistoryByEntity('water_tank', config.DEFAULT_WATER_TANK_ID);
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
