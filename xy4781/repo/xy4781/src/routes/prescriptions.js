const express = require('express');
const router = express.Router();
const prescriptionService = require('../services/prescriptionService');
const inventoryDao = require('../dao/inventoryDao');

router.get('/inventory', (req, res) => {
  try {
    const inventory = inventoryDao.getAllInventory();
    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/', (req, res) => {
  try {
    const prescriptions = prescriptionService.listPrescriptions();
    res.json({
      success: true,
      data: prescriptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/:idOrNo', (req, res) => {
  try {
    const { idOrNo } = req.params;
    const prescription = prescriptionService.getPrescription(idOrNo);
    
    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: {
          message: '处方不存在',
          code: 'PRESCRIPTION_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: prescription
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { patientName, patientIdCard, items } = req.body;
    const operator = req.headers['x-operator'] || 'anonymous';
    const requestIp = req.ip || req.connection.remoteAddress;

    if (!patientName) {
      return res.status(400).json({
        success: false,
        error: {
          message: '患者姓名不能为空',
          code: 'MISSING_PATIENT_NAME'
        }
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: '处方药品明细不能为空',
          code: 'EMPTY_ITEMS'
        }
      });
    }

    const prescription = prescriptionService.createPrescription(
      { patientName, patientIdCard, items },
      operator,
      requestIp
    );

    res.status(201).json({
      success: true,
      data: prescription,
      message: '处方创建成功'
    });
  } catch (error) {
    if (error.name === 'BusinessError') {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

module.exports = router;
