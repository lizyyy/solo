const express = require('express');
const router = express.Router();
const auditService = require('../services/audit-service');

/**
 * 审计日志 API
 */

/**
 * 获取审计日志列表
 */
router.get('/', (req, res) => {
  try {
    const { entity_type, entity_id, operation_type, operator_id, start_time, end_time, limit, offset } = req.query;
    
    const options = {};
    if (entity_type) options.entityType = entity_type;
    if (entity_id) options.entityId = entity_id;
    if (operation_type) options.operationType = operation_type;
    if (operator_id) options.operatorId = operator_id;
    if (start_time) options.startTime = start_time;
    if (end_time) options.endTime = end_time;
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);
    
    const logs = auditService.getAuditLogs(options);
    
    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取特定实体的变更历史
 */
router.get('/history/:entity_type/:entity_id', (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;
    
    const history = auditService.getEntityHistory(entity_type.toUpperCase(), entity_id);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取计划的审计历史
 */
router.get('/plans/:planId', (req, res) => {
  try {
    const { planId } = req.params;
    
    const history = auditService.getEntityHistory('PLAN', planId);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取操作类型枚举
 */
router.get('/operation-types', (req, res) => {
  res.json({
    success: true,
    data: auditService.OPERATION_TYPES
  });
});

/**
 * 获取实体类型枚举
 */
router.get('/entity-types', (req, res) => {
  res.json({
    success: true,
    data: auditService.ENTITY_TYPES
  });
});

/**
 * 手动创建审计日志（用于测试或特殊场景）
 */
router.post('/', (req, res) => {
  try {
    const { operation_type, entity_type, entity_id, old_value, new_value, operator_id, operator_name, notes } = req.body;
    
    if (!operation_type || !entity_type || !entity_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段: operation_type, entity_type, entity_id'
      });
    }
    
    const logId = auditService.createAuditLog({
      operationType: operation_type,
      entityType: entity_type,
      entityId: entity_id,
      oldValue: old_value,
      newValue: new_value,
      operatorId: operator_id,
      operatorName: operator_name,
      notes: notes
    });
    
    res.status(201).json({
      success: true,
      data: { log_id: logId },
      message: '审计日志创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取审计统计信息
 */
router.get('/statistics', (req, res) => {
  try {
    const { start_time, end_time } = req.query;
    
    // 获取所有日志
    const logs = auditService.getAuditLogs({
      startTime: start_time,
      endTime: end_time,
      limit: 10000
    });
    
    // 统计
    const stats = {
      period: {
        start: start_time,
        end: end_time
      },
      total_count: logs.length,
      by_operation_type: {},
      by_entity_type: {},
      by_operator: {}
    };
    
    for (const log of logs) {
      // 按操作类型统计
      stats.by_operation_type[log.operation_type] = (stats.by_operation_type[log.operation_type] || 0) + 1;
      
      // 按实体类型统计
      stats.by_entity_type[log.entity_type] = (stats.by_entity_type[log.entity_type] || 0) + 1;
      
      // 按操作人统计
      if (log.operator_name) {
        stats.by_operator[log.operator_name] = (stats.by_operator[log.operator_name] || 0) + 1;
      }
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
