const express = require('express');
const router = express.Router();
const Vehicle = require('../models/Vehicle');
const VehicleSubscription = require('../models/VehicleSubscription');
const SubscriptionService = require('../services/SubscriptionService');
const ExceptionLog = require('../models/ExceptionLog');

router.post('/', async (req, res) => {
  try {
    const { plate_number, owner_name, owner_phone } = req.body;
    
    if (!plate_number) {
      await ExceptionLog.create({
        exception_type: 'param_validation_error',
        raw_input: req.body,
        error_message: '车牌号不能为空',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '车牌号不能为空'
      });
    }

    const existing = await Vehicle.findByPlate(plate_number);
    if (existing) {
      await ExceptionLog.create({
        exception_type: 'vehicle_exists_error',
        raw_input: req.body,
        error_message: '车辆已存在',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '车辆已存在'
      });
    }

    const vehicleId = await Vehicle.create({
      plate_number,
      owner_name: owner_name || null,
      owner_phone: owner_phone || null,
      balance: 0
    });

    const vehicle = await Vehicle.findById(vehicleId);
    
    res.json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'create_vehicle_error',
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

router.get('/:plateNumber', async (req, res) => {
  try {
    const { plateNumber } = req.params;
    const vehicle = await Vehicle.findByPlate(plateNumber);

    if (!vehicle) {
      await ExceptionLog.create({
        exception_type: 'vehicle_not_found',
        raw_input: { plateNumber },
        error_message: '车辆不存在',
        processing_result: '返回404错误',
        api_path: req.path
      });
      return res.status(404).json({
        success: false,
        error: '车辆不存在'
      });
    }

    const validity = await SubscriptionService.checkSubscriptionValidity(vehicle.id);

    res.json({
      success: true,
      data: {
        vehicle,
        subscription_validity: validity
      }
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'get_vehicle_error',
      raw_input: req.params,
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

router.post('/recharge', async (req, res) => {
  try {
    const { plate_number, amount } = req.body;

    if (!plate_number || !amount || amount <= 0) {
      await ExceptionLog.create({
        exception_type: 'param_validation_error',
        raw_input: req.body,
        error_message: '参数错误: plate_number 或 amount 无效',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '参数错误'
      });
    }

    const result = await SubscriptionService.recharge(plate_number, amount);
    
    res.json(result);
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'recharge_error',
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

router.post('/subscribe', async (req, res) => {
  try {
    const { plate_number, plan_id } = req.body;

    if (!plate_number || !plan_id) {
      await ExceptionLog.create({
        exception_type: 'param_validation_error',
        raw_input: req.body,
        error_message: '参数错误: plate_number 或 plan_id 为空',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '参数错误'
      });
    }

    const result = await SubscriptionService.createSubscription(plate_number, plan_id);
    
    res.json(result);
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'subscribe_error',
      raw_input: req.body,
      error_message: error.message,
      processing_result: '返回400错误',
      api_path: req.path
    });

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:plateNumber/subscriptions', async (req, res) => {
  try {
    const { plateNumber } = req.params;
    const vehicle = await Vehicle.findByPlate(plateNumber);

    if (!vehicle) {
      await ExceptionLog.create({
        exception_type: 'vehicle_not_found',
        raw_input: { plateNumber },
        error_message: '车辆不存在',
        processing_result: '返回404错误',
        api_path: req.path
      });
      return res.status(404).json({
        success: false,
        error: '车辆不存在'
      });
    }

    const subscriptions = await VehicleSubscription.findByVehicleId(vehicle.id);

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'get_subscriptions_error',
      raw_input: req.params,
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
