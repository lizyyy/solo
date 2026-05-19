const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const { processBatch } = require('../utils/validation');

router.post('/', async (req, res) => {
  try {
    const medicine = await Medicine.create(req.body);
    res.json({
      success: true,
      message: '药品创建成功',
      data: medicine,
      reason: '创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '药品创建失败',
      error: error.message,
      reason: error.message
    });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { medicines } = req.body;
    
    const batchResult = processBatch(medicines, async (medicine, index) => {
      try {
        const result = await Medicine.create(medicine);
        return { success: true, id: result.id, reason: '创建成功' };
      } catch (error) {
        return { success: false, reason: error.message };
      }
    });
    
    const results = await Promise.all(batchResult.results.map(async r => {
      const result = await r;
      return result;
    }));
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: failCount === 0,
      message: failCount === 0 ? '批量创建成功' : `批量创建完成，成功 ${successCount} 条，失败 ${failCount} 条`,
      data: {
        successCount,
        failCount,
        results
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '批量操作失败',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const medicines = await Medicine.findAll();
    res.json({
      success: true,
      message: '获取药品列表成功',
      data: medicines
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取药品列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: '药品不存在',
        reason: '未找到该药品'
      });
    }
    res.json({
      success: true,
      message: '获取药品成功',
      data: medicine
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取药品失败',
      error: error.message
    });
  }
});

module.exports = router;
