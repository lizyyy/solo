const express = require('express');
const router = express.Router();
const models = require('../models');
const services = require('../services');

/**
 * 规则引擎相关API路由
 */

// 执行所有规则检查
router.post('/check-all', async (req, res, next) => {
  try {
    const result = await services.rulesEngine.runAllRules();
    
    const missedRecalls = result.missed_notifications?.recalls || [];
    const scrappedItems = result.scrapped_equipment_with_work_orders?.items || [];
    const totalMissed = result.missed_notifications?.total_missed || 0;
    const totalScrapped = result.scrapped_equipment_with_work_orders?.total || 0;
    
    res.json({
      success: true,
      data: {
        missed_notifications: {
          count: totalMissed,
          recalls: missedRecalls
        },
        scrapped_equipment_with_work_orders: {
          count: totalScrapped,
          items: scrappedItems
        },
        summary: {
          total_issues: totalMissed + totalScrapped,
          missed_notifications: totalMissed,
          scrapped_equipment_issues: totalScrapped,
          risk_level: result.summary?.risk_level || 'low'
        }
      },
      message: totalMissed + totalScrapped > 0 
        ? '检测到潜在问题' 
        : '未检测到问题'
    });
  } catch (error) {
    next(error);
  }
});

// 检测漏通知
router.post('/detect-missed-notifications', async (req, res, next) => {
  try {
    const { recall_id } = req.query;
    
    let result;
    if (recall_id) {
      // 检查指定召回清单是否存在
      const recall = await models.recall.getRecallById(recall_id);
      if (!recall) {
        return res.status(404).json({
          success: false,
          error: '召回清单不存在'
        });
      }
      result = await services.rulesEngine.detectMissedNotifications(recall_id);
    } else {
      result = await services.rulesEngine.detectMissedNotifications();
    }
    
    res.json({
      success: true,
      data: {
        count: result.length,
        items: result
      },
      message: result.length > 0 
        ? `检测到 ${result.length} 个批次存在漏通知情况` 
        : '未检测到漏通知情况'
    });
  } catch (error) {
    next(error);
  }
});

// 检测已报废器材派工
router.post('/detect-scrapped-equipment-issues', async (req, res, next) => {
  try {
    const result = await services.rulesEngine.detectScrappedEquipmentWithWorkOrders();
    
    res.json({
      success: true,
      data: {
        count: result.length,
        items: result
      },
      message: result.length > 0 
        ? `检测到 ${result.length} 个已报废器材仍有未完成派工单` 
        : '未检测到已报废器材派工问题'
    });
  } catch (error) {
    next(error);
  }
});

// 检查器材是否在召回批次中
router.post('/check-equipment-in-recall', async (req, res, next) => {
  try {
    const { equipment_id, equipment_code } = req.body;
    
    if (!equipment_id && !equipment_code) {
      return res.status(400).json({
        success: false,
        error: '请提供器材ID或器材编号'
      });
    }
    
    // 获取器材信息
    let equipment;
    if (equipment_id) {
      equipment = await models.equipment.getEquipmentById(equipment_id);
    } else {
      equipment = await models.equipment.getEquipmentByCode(equipment_code);
    }
    
    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: '器材不存在'
      });
    }
    
    // 检查是否在召回批次中
    const result = await services.rulesEngine.checkEquipmentInRecall(equipment.id);
    
    res.json({
      success: true,
      data: {
        equipment: {
          id: equipment.id,
          equipment_code: equipment.equipment_code,
          batch_number: equipment.batch_number,
          is_scrapped: equipment.is_scrapped
        },
        in_recall: result.inRecall,
        active_recalls: result.activeRecalls,
        count: result.activeRecalls.length
      },
      message: result.inRecall 
        ? `器材属于 ${result.activeRecalls.length} 个召回批次` 
        : '器材不属于任何召回批次'
    });
  } catch (error) {
    next(error);
  }
});

// 标记召回匹配为已通知
router.post('/match/:matchId/notify', async (req, res, next) => {
  try {
    const { matchId } = req.params;
    
    // 检查召回匹配是否存在
    const match = await models.recallMatch.getRecallMatchById(matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        error: '召回匹配记录不存在'
      });
    }
    
    if (match.is_notified) {
      return res.status(400).json({
        success: false,
        error: '该召回匹配已标记为已通知'
      });
    }
    
    const result = await services.stateMachine.notifyRecallMatch(matchId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.recallMatch,
      message: '召回匹配已标记为已通知'
    });
  } catch (error) {
    next(error);
  }
});

// 批量标记召回匹配为已通知
router.post('/notify-batch', async (req, res, next) => {
  try {
    const { match_ids, recall_id } = req.body;
    
    let matches = [];
    
    if (match_ids && Array.isArray(match_ids) && match_ids.length > 0) {
      // 批量处理指定的匹配ID
      for (const matchId of match_ids) {
        try {
          const match = await models.recallMatch.getRecallMatchById(matchId);
          if (match && !match.is_notified) {
            matches.push(matchId);
          }
        } catch (err) {
          console.error(`Error checking match ${matchId}:`, err);
        }
      }
    } else if (recall_id) {
      // 处理指定召回清单的所有未通知匹配
      const recall = await models.recall.getRecallById(recall_id);
      if (!recall) {
        return res.status(404).json({
          success: false,
          error: '召回清单不存在'
        });
      }
      
      const allMatches = await models.recallMatch.getRecallMatchesByRecallId(recall_id);
      matches = allMatches
        .filter(m => !m.is_notified)
        .map(m => m.id);
    } else {
      return res.status(400).json({
        success: false,
        error: '请提供 match_ids 或 recall_id'
      });
    }
    
    const successCount = 0;
    const failCount = 0;
    const errors = [];
    
    for (const matchId of matches) {
      try {
        const result = await services.stateMachine.notifyRecallMatch(matchId);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          errors.push({
            match_id: matchId,
            error: result.error
          });
        }
      } catch (err) {
        failCount++;
        errors.push({
          match_id: matchId,
          error: err.message
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        total_processed: matches.length,
        success_count: successCount,
        fail_count: failCount,
        errors: errors
      },
      message: `批量通知完成，成功 ${successCount} 个，失败 ${failCount} 个`
    });
  } catch (error) {
    next(error);
  }
});

// 获取规则引擎健康检查
router.get('/health', async (req, res, next) => {
  try {
    // 检查各个模块是否可用
    const modules = [
      { name: 'rulesEngine', available: typeof services.rulesEngine !== 'undefined' },
      { name: 'stateMachine', available: typeof services.stateMachine !== 'undefined' },
      { name: 'riskCalculator', available: typeof services.riskCalculator !== 'undefined' }
    ];
    
    const allAvailable = modules.every(m => m.available);
    
    res.json({
      success: true,
      data: {
        modules,
        all_available: allAvailable,
        available_rules: [
          'recall_matching',
          'missed_notification_detection',
          'scrapped_equipment_detection',
          'equipment_recall_check'
        ],
        state_transitions: [
          'created → assigned → in_progress → completed',
          'created → assigned → in_progress → cancelled',
          'pending → notified'
        ],
        risk_levels: ['low', 'medium', 'high', 'critical']
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
