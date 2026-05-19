const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');

router.post('/', async (req, res) => {
  try {
    const inventory = await Inventory.create(req.body);
    res.json({
      success: true,
      message: '库存添加成功',
      data: inventory,
      reason: '创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '库存添加失败',
      error: error.message,
      reason: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const inventory = await Inventory.findAll();
    res.json({
      success: true,
      message: '获取库存列表成功',
      data: inventory
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取库存列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id);
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: '库存不存在',
        reason: '未找到该库存记录'
      });
    }
    res.json({
      success: true,
      message: '获取库存信息成功',
      data: inventory
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取库存信息失败',
      error: error.message
    });
  }
});

router.get('/medicine/:medicineId/available', async (req, res) => {
  try {
    const inventory = await Inventory.findAvailableByMedicineId(req.params.medicineId);
    res.json({
      success: true,
      message: '获取可用库存成功',
      data: inventory,
      reason: `找到 ${inventory.length} 条可用库存记录`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取可用库存失败',
      error: error.message
    });
  }
});

module.exports = router;
