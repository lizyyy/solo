const express = require('express');
const router = express.Router();
const MonthlyPlan = require('../models/MonthlyPlan');

router.post('/', async (req, res) => {
  try {
    const { plan_name, price, duration_days, description } = req.body;

    if (!plan_name || !price || !duration_days) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const planId = await MonthlyPlan.create({
      plan_name,
      price,
      duration_days,
      description,
      is_active: 1
    });

    res.json({
      success: true,
      data: { plan_id: planId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const plans = await MonthlyPlan.listActive();
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
