const express = require('express');
const router = express.Router();
const MonthlyPlan = require('../models/MonthlyPlan');
const ExceptionLog = require('../models/ExceptionLog');

router.post('/', async (req, res) => {
  try {
    const { plan_name, price, duration_days, description } = req.body;

    if (!plan_name || !price || !duration_days) {
      await ExceptionLog.create({
        exception_type: 'param_validation_error',
        raw_input: req.body,
        error_message: '缺少必要参数: plan_name, price, duration_days',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    if (price <= 0 || duration_days <= 0) {
      await ExceptionLog.create({
        exception_type: 'param_validation_error',
        raw_input: req.body,
        error_message: '参数值无效: price 和 duration_days 必须大于0',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '参数值无效'
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
    await ExceptionLog.create({
      exception_type: 'create_plan_error',
      raw_input: req.body,
      error_message: error.message,
      processing_result: '返回500错误',
      api_path: req.path
    });
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
    await ExceptionLog.create({
      exception_type: 'list_plans_error',
      raw_input: req.query,
      error_message: error.message,
      processing_result: '返回500错误',
      api_path: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
