const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * 器材台账相关API路由
 */

// 获取所有器材
router.get('/', async (req, res, next) => {
  try {
    const equipment = await models.equipment.getAllEquipment();
    res.json({
      success: true,
      data: equipment,
      count: equipment.length
    });
  } catch (error) {
    next(error);
  }
});

// 根据ID获取器材
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const equipment = await models.equipment.getEquipmentById(id);
    
    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: '器材不存在'
      });
    }
    
    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    next(error);
  }
});

// 根据器材编号获取器材
router.get('/code/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const equipment = await models.equipment.getEquipmentByCode(code);
    
    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: '器材不存在'
      });
    }
    
    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    next(error);
  }
});

// 根据批次号获取器材
router.get('/batch/:batchNumber', async (req, res, next) => {
  try {
    const { batchNumber } = req.params;
    const equipment = await models.equipment.getEquipmentByBatch(batchNumber);
    
    res.json({
      success: true,
      data: equipment,
      count: equipment.length
    });
  } catch (error) {
    next(error);
  }
});

// 获取已报废器材
router.get('/scrapped', async (req, res, next) => {
  try {
    const equipment = await models.equipment.getScrappedEquipment();
    
    res.json({
      success: true,
      data: equipment,
      count: equipment.length
    });
  } catch (error) {
    next(error);
  }
});

// 创建器材
router.post('/', async (req, res, next) => {
  try {
    const equipmentData = req.body;
    
    // 校验必填字段
    if (!equipmentData.equipment_code || !equipmentData.equipment_code.trim()) {
      return res.status(400).json({
        success: false,
        error: '器材编号不能为空'
      });
    }
    
    if (!equipmentData.batch_number || !equipmentData.batch_number.trim()) {
      return res.status(400).json({
        success: false,
        error: '批次号不能为空'
      });
    }
    
    // 检查器材编号是否已存在
    const existing = await models.equipment.getEquipmentByCode(equipmentData.equipment_code);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: '器材编号已存在'
      });
    }
    
    const equipment = await models.equipment.createEquipment(equipmentData);
    
    res.status(201).json({
      success: true,
      data: equipment,
      message: '器材创建成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新器材
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 检查器材是否存在
    const existing = await models.equipment.getEquipmentById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '器材不存在'
      });
    }
    
    const equipment = await models.equipment.updateEquipment(id, updateData);
    
    res.json({
      success: true,
      data: equipment,
      message: '器材更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 报废器材
router.post('/:id/scrap', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scrapped_date } = req.body;
    
    // 检查器材是否存在
    const existing = await models.equipment.getEquipmentById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '器材不存在'
      });
    }
    
    // 检查是否已报废
    if (existing.is_scrapped) {
      return res.status(400).json({
        success: false,
        error: '器材已报废'
      });
    }
    
    const equipment = await models.equipment.scrapEquipment(id, scrapped_date);
    
    res.json({
      success: true,
      data: equipment,
      message: '器材报废成功'
    });
  } catch (error) {
    next(error);
  }
});

// 获取器材统计
router.get('/stats/summary', async (req, res, next) => {
  try {
    const stats = await models.equipment.getEquipmentStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// 获取器材的巡检记录
router.get('/:id/inspections', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 检查器材是否存在
    const existing = await models.equipment.getEquipmentById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '器材不存在'
      });
    }
    
    const inspections = await models.inspection.getInspectionsByEquipmentId(id);
    
    res.json({
      success: true,
      data: inspections,
      count: inspections.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
