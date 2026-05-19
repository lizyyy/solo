const express = require('express');
const router = express.Router();
const EquipmentService = require('../services/EquipmentService');
const { Parser } = require('json2csv');

router.post('/borrow', async (req, res) => {
  try {
    const { barcode, toBoothId, operator, remark } = req.body;
    
    if (!barcode || !toBoothId || !operator) {
      return res.status(400).json({
        success: false,
        reason: '缺少必要参数: barcode, toBoothId, operator'
      });
    }

    const result = await EquipmentService.borrowEquipment(barcode, toBoothId, operator, remark);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

router.post('/return', async (req, res) => {
  try {
    const { barcode, toBoothId, operator, damageLevel, damageFee, remark } = req.body;
    
    if (!barcode || !toBoothId || !operator) {
      return res.status(400).json({
        success: false,
        reason: '缺少必要参数: barcode, toBoothId, operator'
      });
    }

    const result = await EquipmentService.returnEquipment(
      barcode, 
      toBoothId, 
      operator, 
      damageLevel, 
      damageFee || 0, 
      remark
    );
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

router.post('/rollback/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { operator } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        reason: '缺少必要参数: operator'
      });
    }

    const result = await EquipmentService.rollbackRecord(recordId, operator);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

router.get('/records', async (req, res) => {
  try {
    const filters = {
      operator: req.query.operator,
      status: req.query.status,
      operationType: req.query.operationType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      hasDamage: req.query.hasDamage === 'true'
    };

    const records = await EquipmentService.queryRecords(filters);
    res.json({
      success: true,
      data: records,
      total: records.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

router.get('/records/export', async (req, res) => {
  try {
    const filters = {
      operator: req.query.operator,
      status: req.query.status,
      operationType: req.query.operationType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      hasDamage: req.query.hasDamage === 'true'
    };

    const records = await EquipmentService.queryRecords(filters);
    
    const fields = [
      'id',
      'operation_type',
      'status',
      'barcode',
      'equipment_name',
      'equipment_type',
      'from_booth',
      'to_booth',
      'operator',
      'remark',
      'damage_level',
      'damage_fee',
      'operation_reason',
      'created_at'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=equipment_records_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '导出失败',
      error: error.message
    });
  }
});

router.get('/equipments', async (req, res) => {
  try {
    const equipments = await EquipmentService.getAllEquipments();
    res.json({
      success: true,
      data: equipments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

router.get('/booths', async (req, res) => {
  try {
    const booths = await EquipmentService.getAllBooths();
    res.json({
      success: true,
      data: booths
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const logs = await EquipmentService.getOperationLogs();
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await EquipmentService.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

router.get('/equipment/:barcode', async (req, res) => {
  try {
    const equipment = await EquipmentService.getEquipmentByBarcode(req.params.barcode);
    if (equipment) {
      res.json({
        success: true,
        data: equipment
      });
    } else {
      res.status(404).json({
        success: false,
        reason: '设备不存在'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      reason: '服务器错误',
      error: error.message
    });
  }
});

module.exports = router;
