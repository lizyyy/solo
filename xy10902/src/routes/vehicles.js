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
      return res.status(400).json({
        success: false,
        error: '车牌号不能为空'
      });
    }

    const existing = await Vehicle.findByPlate(plate_number);
    if (existing) {
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
