const express = require('express');
const router = express.Router();
const models = require('../models');
const services = require('../services');

/**
 * 召回清单相关API路由
 */

// 获取所有召回清单
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    
    let recalls;
    if (status === 'active') {
      recalls = await models.recall.getActiveRecalls();
    } else {
      recalls = await models.recall.getAllRecalls();
    }
    
    res.json({
      success: true,
      data: recalls,
      count: recalls.length
    });
  } catch (error) {
    next(error);
  }
});

// 根据ID获取召回清单
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const recall = await models.recall.getRecallById(id);
    
    if (!recall) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    res.json({
      success: true,
      data: recall
    });
  } catch (error) {
    next(error);
  }
});

// 根据召回编号获取召回清单
router.get('/code/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const recall = await models.recall.getRecallByCode(code);
    
    if (!recall) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    res.json({
      success: true,
      data: recall
    });
  } catch (error) {
    next(error);
  }
});

// 创建召回清单
router.post('/', async (req, res, next) => {
  try {
    const recallData = req.body;
    
    // 校验必填字段
    if (!recallData.recall_code || !recallData.recall_code.trim()) {
      return res.status(400).json({
        success: false,
        error: '召回编号不能为空'
      });
    }
    
    if (!recallData.manufacturer || !recallData.manufacturer.trim()) {
      return res.status(400).json({
        success: false,
        error: '生产厂家不能为空'
      });
    }
    
    if (!recallData.recall_reason || !recallData.recall_reason.trim()) {
      return res.status(400).json({
        success: false,
        error: '召回原因不能为空'
      });
    }
    
    if (!recallData.deadline_date || !recallData.deadline_date.trim()) {
      return res.status(400).json({
        success: false,
        error: '整改期限不能为空'
      });
    }
    
    if (!recallData.affected_batches || 
        (Array.isArray(recallData.affected_batches) && recallData.affected_batches.length === 0)) {
      return res.status(400).json({
        success: false,
        error: '涉及批次不能为空'
      });
    }
    
    // 检查召回编号是否已存在
    const existing = await models.recall.getRecallByCode(recallData.recall_code);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: '召回编号已存在'
      });
    }
    
    const recall = await models.recall.createRecall(recallData);
    
    res.status(201).json({
      success: true,
      data: recall,
      message: '召回清单创建成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新召回清单
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 检查召回清单是否存在
    const existing = await models.recall.getRecallById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    const recall = await models.recall.updateRecall(id, updateData);
    
    res.json({
      success: true,
      data: recall,
      message: '召回清单更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 关闭召回清单
router.post('/:id/close', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 检查召回清单是否存在
    const existing = await models.recall.getRecallById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    if (existing.status === 'closed') {
      return res.status(400).json({
        success: false,
        error: '召回清单已关闭'
      });
    }
    
    const recall = await models.recall.closeRecall(id);
    
    res.json({
      success: true,
      data: recall,
      message: '召回清单关闭成功'
    });
  } catch (error) {
    next(error);
  }
});

// 删除召回清单
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 检查召回清单是否存在
    const existing = await models.recall.getRecallById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    await models.recall.deleteRecall(id);
    
    res.json({
      success: true,
      message: '召回清单删除成功'
    });
  } catch (error) {
    next(error);
  }
});

// 执行召回匹配
router.post('/:id/match', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 检查召回清单是否存在
    const existing = await models.recall.getRecallById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    const result = await services.rulesEngine.performRecallMatching(id);
    
    res.json({
      success: true,
      data: {
        matched_count: result.matched.length,
        skipped_count: result.skipped.length,
        error_count: result.errors.length,
        matched: result.matched,
        skipped: result.skipped,
        errors: result.errors
      },
      message: `召回匹配完成，匹配 ${result.matched.length} 个器材`
    });
  } catch (error) {
    next(error);
  }
});

// 获取召回的匹配记录
router.get('/:id/matches', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 检查召回清单是否存在
    const existing = await models.recall.getRecallById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    const matches = await models.recallMatch.getRecallMatchesByRecallId(id);
    
    // 统计
    const stats = {
      total: matches.length,
      pending: matches.filter(m => m.status === 'pending').length,
      notified: matches.filter(m => m.is_notified === 1).length,
      completed: matches.filter(m => m.status === 'completed').length
    };
    
    res.json({
      success: true,
      data: matches,
      stats,
      count: matches.length
    });
  } catch (error) {
    next(error);
  }
});

// 获取召回统计
router.get('/stats/summary', async (req, res, next) => {
  try {
    const stats = await models.recall.getRecallStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
