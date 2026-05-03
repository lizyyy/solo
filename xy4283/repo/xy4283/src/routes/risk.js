const express = require('express');
const router = express.Router();
const models = require('../models');
const services = require('../services');

/**
 * 逾期风险相关API路由
 */

// 执行全面风险扫描
router.post('/scan', async (req, res, next) => {
  try {
    const result = await services.riskCalculator.performFullRiskScan();
    
    res.json({
      success: true,
      data: {
        scanned_count: result.scannedCount,
        created_count: result.createdCount,
        updated_count: result.updatedCount,
        resolved_count: result.resolvedCount
      },
      message: '风险扫描完成'
    });
  } catch (error) {
    next(error);
  }
});

// 获取所有逾期风险
router.get('/', async (req, res, next) => {
  try {
    const { level, status, entity_type } = req.query;
    
    let risks;
    
    if (level) {
      risks = await models.overdueRisk.getRisksByLevel(level);
    } else if (status) {
      risks = await models.overdueRisk.getRisksByStatus(status);
    } else if (entity_type) {
      risks = await models.overdueRisk.getRisksByEntityType(entity_type);
    } else {
      risks = await models.overdueRisk.getAllRisks();
    }
    
    res.json({
      success: true,
      data: risks,
      count: risks.length
    });
  } catch (error) {
    next(error);
  }
});

// 根据ID获取逾期风险
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const risk = await models.overdueRisk.getRiskById(id);
    
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: risk
    });
  } catch (error) {
    next(error);
  }
});

// 获取高风险项目
router.get('/level/high', async (req, res, next) => {
  try {
    const highRisks = await services.riskCalculator.getHighRiskItems();
    
    res.json({
      success: true,
      data: highRisks,
      count: highRisks.length
    });
  } catch (error) {
    next(error);
  }
});

// 获取即将逾期的项目
router.get('/upcoming', async (req, res, next) => {
  try {
    const { days } = req.query;
    const daysAhead = days ? parseInt(days) : 3;
    
    const upcoming = await services.riskCalculator.getUpcomingDeadlines(daysAhead);
    
    res.json({
      success: true,
      data: upcoming,
      count: upcoming.length,
      days_ahead: daysAhead
    });
  } catch (error) {
    next(error);
  }
});

// 标记风险已解决
router.post('/:id/resolve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolve_note } = req.body;
    
    // 检查风险记录是否存在
    const existing = await models.overdueRisk.getRiskById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '风险记录不存在'
      });
    }
    
    if (existing.status === 'resolved') {
      return res.status(400).json({
        success: false,
        error: '风险记录已解决'
      });
    }
    
    const risk = await services.riskCalculator.resolveRisk(id, resolve_note);
    
    res.json({
      success: true,
      data: risk,
      message: '风险记录已标记为已解决'
    });
  } catch (error) {
    next(error);
  }
});

// 获取风险统计
router.get('/stats/summary', async (req, res, next) => {
  try {
    const stats = await models.overdueRisk.getRiskStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// 获取风险等级分布
router.get('/stats/distribution', async (req, res, next) => {
  try {
    const distribution = await models.overdueRisk.getRiskLevelDistribution();
    
    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
