const express = require('express');
const router = express.Router();
const coldChainService = require('../services/coldChainService');
const store = require('../models/store');
const AppError = require('../utils/errors');

router.get('/status', (req, res) => {
  try {
    const status = coldChainService.getColdChainStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.get('/boxes', (req, res) => {
  res.json({
    success: true,
    data: {
      coldBoxes: store.getAllColdBoxes()
    }
  });
});

router.get('/boxes/:id', (req, res) => {
  try {
    const coldBox = store.getColdBoxById(req.params.id);
    if (!coldBox) {
      throw new AppError('冷链箱不存在', 404);
    }
    
    const relatedInventory = store.getAllInventory().filter(inv => inv.coldBoxId === req.params.id);
    const exceptions = store.getExceptionsByColdBoxId(req.params.id);
    
    res.json({
      success: true,
      data: {
        coldBox,
        relatedInventory,
        exceptions
      }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.post('/boxes/:id/exception', (req, res) => {
  try {
    const { exceptionType, temperature, details } = req.body;
    
    if (!exceptionType || temperature === undefined) {
      throw new AppError('缺少必填字段: exceptionType, temperature', 400);
    }
    
    const result = coldChainService.reportColdBoxException(
      req.params.id,
      exceptionType,
      temperature,
      details || {}
    );
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.post('/boxes/:id/resolve', (req, res) => {
  try {
    const { resolution, manualCorrection } = req.body;
    
    if (!resolution && !manualCorrection) {
      throw new AppError('必须提供 resolution 或 manualCorrection', 400);
    }
    
    const result = coldChainService.resolveColdBoxException(
      req.params.id,
      resolution,
      manualCorrection || false
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.get('/inventory', (req, res) => {
  res.json({
    success: true,
    data: {
      inventory: store.getAllInventory()
    }
  });
});

router.get('/inventory/:id', (req, res) => {
  try {
    const inventory = store.getInventoryById(req.params.id);
    if (!inventory) {
      throw new AppError('库存不存在', 404);
    }
    
    const coldBox = store.getColdBoxById(inventory.coldBoxId);
    const appointments = store.getAppointmentsByInventoryId(inventory.id);
    const exceptions = store.getExceptionsByInventoryId(inventory.id);
    const activeLocks = store.getLocksByInventoryId(inventory.id);
    
    res.json({
      success: true,
      data: {
        inventory,
        coldBox,
        appointments,
        exceptions,
        activeLocks
      }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.get('/exceptions', (req, res) => {
  res.json({
    success: true,
    data: {
      exceptions: store.getAllExceptions()
    }
  });
});

router.get('/exceptions/:id', (req, res) => {
  try {
    const exception = store.getExceptionById(req.params.id);
    if (!exception) {
      throw new AppError('异常记录不存在', 404);
    }
    res.json({
      success: true,
      data: exception
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

module.exports = router;
