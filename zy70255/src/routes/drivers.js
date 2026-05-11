const express = require('express');
const router = express.Router();
const { response, errorResponse } = require('../utils');
const driverService = require('../services/driverService');

router.get('/', (req, res) => {
  try {
    const drivers = driverService.listDrivers();
    response(res, drivers);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.post('/', (req, res) => {
  const { name, phone, car_type } = req.body;

  if (!name || !car_type) {
    return errorResponse(res, '缺少必要参数: name 或 car_type');
  }

  try {
    const driver = driverService.createDriver(name, phone, car_type);
    response(res, driver, 201);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.get('/:id', (req, res) => {
  const driver = driverService.getDriverById(req.params.id);
  if (!driver) {
    return errorResponse(res, '司机不存在', 404);
  }
  response(res, driver);
});

router.put('/:id', (req, res) => {
  try {
    const driver = driverService.updateDriver(req.params.id, req.body);
    if (!driver) {
      return errorResponse(res, '司机不存在', 404);
    }
    response(res, driver);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

module.exports = router;
