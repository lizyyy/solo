const express = require('express');
const router = express.Router();
const maintenanceService = require('../services/maintenanceService');
const db = require('../data/database');

router.post('/fault-orders', (req, res) => {
  try {
    const duplicateCheck = maintenanceService.checkDuplicateRequest(
      'POST', '/api/fault-orders', req.body
    );
    
    if (duplicateCheck.isDuplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '重复请求，返回缓存结果',
        data: duplicateCheck.cachedResponse
      });
    }

    const data = maintenanceService.createFaultOrder(req.body);
    db.logRequest(duplicateCheck.requestKey, data);
    
    res.status(201).json({
      success: true,
      message: '故障单创建成功',
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/fault-orders/:id/request-parts', (req, res) => {
  try {
    const { partsRequest, operator } = req.body;
    
    const duplicateCheck = maintenanceService.checkDuplicateRequest(
      'POST', `/api/fault-orders/${req.params.id}/request-parts`, req.body
    );
    
    if (duplicateCheck.isDuplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '重复请求，返回缓存结果',
        data: duplicateCheck.cachedResponse
      });
    }

    const data = maintenanceService.requestParts(req.params.id, partsRequest, operator);
    db.logRequest(duplicateCheck.requestKey, data);
    
    res.status(200).json({
      success: true,
      message: '备件领用申请成功',
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/fault-orders/:id/sign-parts', (req, res) => {
  try {
    const { signatures, operator } = req.body;
    
    const duplicateCheck = maintenanceService.checkDuplicateRequest(
      'POST', `/api/fault-orders/${req.params.id}/sign-parts`, req.body
    );
    
    if (duplicateCheck.isDuplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '重复请求，返回缓存结果',
        data: duplicateCheck.cachedResponse
      });
    }

    const data = maintenanceService.signForParts(req.params.id, signatures, operator);
    db.logRequest(duplicateCheck.requestKey, data);
    
    res.status(200).json({
      success: true,
      message: '备件签收成功',
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/fault-orders/:id/confirm-replacement', (req, res) => {
  try {
    const { replacements, operator } = req.body;
    
    const duplicateCheck = maintenanceService.checkDuplicateRequest(
      'POST', `/api/fault-orders/${req.params.id}/confirm-replacement`, req.body
    );
    
    if (duplicateCheck.isDuplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '重复请求，返回缓存结果',
        data: duplicateCheck.cachedResponse
      });
    }

    const data = maintenanceService.confirmReplacement(req.params.id, replacements, operator);
    db.logRequest(duplicateCheck.requestKey, data);
    
    res.status(200).json({
      success: true,
      message: '换件确认成功',
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/fault-orders/:id/complete', (req, res) => {
  try {
    const { operator, remark } = req.body;
    
    const duplicateCheck = maintenanceService.checkDuplicateRequest(
      'POST', `/api/fault-orders/${req.params.id}/complete`, req.body
    );
    
    if (duplicateCheck.isDuplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '重复请求，返回缓存结果',
        data: duplicateCheck.cachedResponse
      });
    }

    const data = maintenanceService.completeFaultOrder(req.params.id, operator, remark);
    db.logRequest(duplicateCheck.requestKey, data);
    
    res.status(200).json({
      success: true,
      message: '故障单完成',
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/fault-orders/:id/revert', (req, res) => {
  try {
    const { operator, remark } = req.body;
    const data = maintenanceService.revertFaultOrder(req.params.id, operator, remark);
    
    res.status(200).json({
      success: true,
      message: '故障单已撤回',
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/fault-orders/:id/restart', (req, res) => {
  try {
    const { operator, remark } = req.body;
    const data = maintenanceService.restartFaultOrder(req.params.id, operator, remark);
    
    res.status(200).json({
      success: true,
      message: '故障单已重新启动',
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/fault-orders/:id', (req, res) => {
  try {
    const data = maintenanceService.getFaultOrderDetail(req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        error: '故障单不存在'
      });
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/fault-orders', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      elevatorId: req.query.elevatorId
    };
    const data = maintenanceService.getFaultOrderList(filters);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/spare-parts', (req, res) => {
  try {
    const filters = {
      partName: req.query.partName,
      availableOnly: req.query.availableOnly === 'true'
    };
    const data = maintenanceService.getSparePartList(filters);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/summary', (req, res) => {
  try {
    const data = maintenanceService.getSummaryReport();
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
