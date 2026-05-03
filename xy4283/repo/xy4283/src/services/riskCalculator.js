const models = require('../models');
const dayjs = require('dayjs');

/**
 * 逾期风险计算服务
 * 负责计算派工单和召回的逾期风险，评估风险等级
 */

// 风险等级定义
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// 风险等级阈值（天数）
const RISK_THRESHOLDS = {
  [RISK_LEVELS.LOW]: { min: 0, max: 2 },
  [RISK_LEVELS.MEDIUM]: { min: 3, max: 7 },
  [RISK_LEVELS.HIGH]: { min: 8, max: 14 },
  [RISK_LEVELS.CRITICAL]: { min: 15, max: Infinity }
};

// 风险等级描述
const RISK_DESCRIPTIONS = {
  [RISK_LEVELS.LOW]: '低风险 - 刚逾期或即将逾期，需要关注',
  [RISK_LEVELS.MEDIUM]: '中风险 - 逾期3-7天，需要提醒处理人员',
  [RISK_LEVELS.HIGH]: '高风险 - 逾期8-14天，需要跟进并制定解决方案',
  [RISK_LEVELS.CRITICAL]: '严重风险 - 逾期15天以上，需要紧急处理并上报'
};

/**
 * 计算两个日期之间的天数差
 * @param {string} deadlineDate - 截止日期
 * @param {string} currentDate - 当前日期（可选，默认为今天）
 * @returns {number} 逾期天数（正数表示已逾期，负数表示未逾期）
 */
function calculateDaysOverdue(deadlineDate, currentDate = null) {
  const today = currentDate ? dayjs(currentDate) : dayjs();
  const deadline = dayjs(deadlineDate);
  
  if (!deadline.isValid()) {
    return 0;
  }
  
  // 计算天数差（今天 - 截止日期）
  const daysDiff = today.diff(deadline, 'day');
  
  return daysDiff;
}

/**
 * 根据逾期天数评估风险等级
 * @param {number} daysOverdue - 逾期天数
 * @returns {string} 风险等级
 */
function evaluateRiskLevel(daysOverdue) {
  if (daysOverdue <= 0) {
    return null; // 未逾期
  }
  
  for (const [level, thresholds] of Object.entries(RISK_THRESHOLDS)) {
    if (daysOverdue >= thresholds.min && daysOverdue <= thresholds.max) {
      return level;
    }
  }
  
  return RISK_LEVELS.CRITICAL;
}

/**
 * 计算单个派工单的逾期风险
 * @param {Object} workOrder - 派工单对象
 * @param {string} currentDate - 当前日期（可选）
 * @returns {Object|null} 风险信息，如果未逾期返回null
 */
function calculateWorkOrderRisk(workOrder, currentDate = null) {
  // 检查派工单状态 - 已完成或已取消的不计算风险
  if (workOrder.status === 'completed' || workOrder.status === 'cancelled') {
    return null;
  }
  
  // 检查是否有截止日期
  if (!workOrder.deadline_date) {
    return null;
  }
  
  const daysOverdue = calculateDaysOverdue(workOrder.deadline_date, currentDate);
  
  // 未逾期
  if (daysOverdue <= 0) {
    return null;
  }
  
  const riskLevel = evaluateRiskLevel(daysOverdue);
  
  return {
    entity_type: 'work_order',
    entity_id: workOrder.id,
    deadline_date: workOrder.deadline_date,
    days_overdue: daysOverdue,
    risk_level: riskLevel,
    work_order_code: workOrder.order_code,
    assigned_to: workOrder.assigned_to,
    status: workOrder.status
  };
}

/**
 * 计算单个召回的逾期风险
 * @param {Object} recall - 召回清单对象
 * @param {string} currentDate - 当前日期（可选）
 * @returns {Object|null} 风险信息，如果未逾期返回null
 */
function calculateRecallRisk(recall, currentDate = null) {
  // 检查召回状态 - 已完成或已关闭的不计算风险
  if (recall.status === 'completed' || recall.status === 'closed' || recall.status === 'cancelled') {
    return null;
  }
  
  // 检查是否有截止日期
  if (!recall.deadline_date) {
    return null;
  }
  
  const daysOverdue = calculateDaysOverdue(recall.deadline_date, currentDate);
  
  // 未逾期
  if (daysOverdue <= 0) {
    return null;
  }
  
  const riskLevel = evaluateRiskLevel(daysOverdue);
  
  return {
    entity_type: 'recall',
    entity_id: recall.id,
    deadline_date: recall.deadline_date,
    days_overdue: daysOverdue,
    risk_level: riskLevel,
    recall_code: recall.recall_code,
    manufacturer: recall.manufacturer,
    status: recall.status
  };
}

/**
 * 扫描所有派工单，计算逾期风险
 * @param {string} currentDate - 当前日期（可选）
 * @returns {Promise<{total: number, byLevel: Object, risks: Array}>}
 */
async function scanWorkOrdersForRisk(currentDate = null) {
  try {
    // 获取所有派工单
    const allWorkOrders = await models.workOrder.getAllWorkOrders();
    
    const risks = [];
    const byLevel = {
      [RISK_LEVELS.LOW]: 0,
      [RISK_LEVELS.MEDIUM]: 0,
      [RISK_LEVELS.HIGH]: 0,
      [RISK_LEVELS.CRITICAL]: 0
    };
    
    for (const workOrder of allWorkOrders) {
      const risk = calculateWorkOrderRisk(workOrder, currentDate);
      if (risk) {
        risks.push(risk);
        byLevel[risk.risk_level]++;
      }
    }
    
    // 更新风险记录表
    for (const risk of risks) {
      await models.overdueRisk.createOverdueRisk({
        entity_type: risk.entity_type,
        entity_id: risk.entity_id,
        deadline_date: risk.deadline_date,
        risk_level: risk.risk_level,
        days_overdue: risk.days_overdue
      });
    }
    
    return {
      total: risks.length,
      by_level: byLevel,
      risks
    };
    
  } catch (error) {
    throw new Error(`扫描派工单风险失败: ${error.message}`);
  }
}

/**
 * 扫描所有召回清单，计算逾期风险
 * @param {string} currentDate - 当前日期（可选）
 * @returns {Promise<{total: number, byLevel: Object, risks: Array}>}
 */
async function scanRecallsForRisk(currentDate = null) {
  try {
    // 获取所有召回清单
    const allRecalls = await models.recall.getAllRecalls();
    
    const risks = [];
    const byLevel = {
      [RISK_LEVELS.LOW]: 0,
      [RISK_LEVELS.MEDIUM]: 0,
      [RISK_LEVELS.HIGH]: 0,
      [RISK_LEVELS.CRITICAL]: 0
    };
    
    for (const recall of allRecalls) {
      const risk = calculateRecallRisk(recall, currentDate);
      if (risk) {
        risks.push(risk);
        byLevel[risk.risk_level]++;
      }
    }
    
    // 更新风险记录表
    for (const risk of risks) {
      await models.overdueRisk.createOverdueRisk({
        entity_type: risk.entity_type,
        entity_id: risk.entity_id,
        deadline_date: risk.deadline_date,
        risk_level: risk.risk_level,
        days_overdue: risk.days_overdue
      });
    }
    
    return {
      total: risks.length,
      by_level: byLevel,
      risks
    };
    
  } catch (error) {
    throw new Error(`扫描召回清单风险失败: ${error.message}`);
  }
}

/**
 * 执行全面风险扫描
 * @param {string} currentDate - 当前日期（可选）
 * @returns {Promise<Object>} 全面风险扫描结果
 */
async function performFullRiskScan(currentDate = null) {
  try {
    const [workOrderRisks, recallRisks] = await Promise.all([
      scanWorkOrdersForRisk(currentDate),
      scanRecallsForRisk(currentDate)
    ]);
    
    // 统计汇总
    const totalRisks = workOrderRisks.total + recallRisks.total;
    const combinedByLevel = {
      [RISK_LEVELS.LOW]: workOrderRisks.by_level[RISK_LEVELS.LOW] + recallRisks.by_level[RISK_LEVELS.LOW],
      [RISK_LEVELS.MEDIUM]: workOrderRisks.by_level[RISK_LEVELS.MEDIUM] + recallRisks.by_level[RISK_LEVELS.MEDIUM],
      [RISK_LEVELS.HIGH]: workOrderRisks.by_level[RISK_LEVELS.HIGH] + recallRisks.by_level[RISK_LEVELS.HIGH],
      [RISK_LEVELS.CRITICAL]: workOrderRisks.by_level[RISK_LEVELS.CRITICAL] + recallRisks.by_level[RISK_LEVELS.CRITICAL]
    };
    
    // 计算整体风险等级
    let overallRisk = RISK_LEVELS.LOW;
    if (combinedByLevel[RISK_LEVELS.CRITICAL] > 0) {
      overallRisk = RISK_LEVELS.CRITICAL;
    } else if (combinedByLevel[RISK_LEVELS.HIGH] > 0) {
      overallRisk = RISK_LEVELS.HIGH;
    } else if (combinedByLevel[RISK_LEVELS.MEDIUM] > 0) {
      overallRisk = RISK_LEVELS.MEDIUM;
    }
    
    return {
      timestamp: new Date().toISOString(),
      current_date: currentDate || dayjs().format('YYYY-MM-DD'),
      summary: {
        total_risks: totalRisks,
        overall_risk: overallRisk,
        by_level: combinedByLevel
      },
      work_orders: workOrderRisks,
      recalls: recallRisks,
      risk_descriptions: RISK_DESCRIPTIONS
    };
    
  } catch (error) {
    throw new Error(`执行全面风险扫描失败: ${error.message}`);
  }
}

/**
 * 获取即将逾期的项目（3天内到期）
 * @param {string} currentDate - 当前日期（可选）
 * @returns {Promise<{work_orders: Array, recalls: Array, total: number}>}
 */
async function getUpcomingDeadlines(currentDate = null) {
  try {
    const today = currentDate ? dayjs(currentDate) : dayjs();
    const threeDaysLater = today.add(3, 'day').format('YYYY-MM-DD');
    const todayStr = today.format('YYYY-MM-DD');
    
    // 获取所有派工单
    const allWorkOrders = await models.workOrder.getAllWorkOrders();
    const upcomingWorkOrders = allWorkOrders.filter(wo => {
      if (wo.status === 'completed' || wo.status === 'cancelled') {
        return false;
      }
      if (!wo.deadline_date) {
        return false;
      }
      const deadline = dayjs(wo.deadline_date);
      return deadline.isAfter(todayStr) && deadline.isBefore(threeDaysLater) || deadline.isSame(todayStr, 'day');
    }).map(wo => ({
      id: wo.id,
      order_code: wo.order_code,
      deadline_date: wo.deadline_date,
      status: wo.status,
      assigned_to: wo.assigned_to,
      days_until_deadline: dayjs(wo.deadline_date).diff(today, 'day')
    }));
    
    // 获取所有召回清单
    const allRecalls = await models.recall.getAllRecalls();
    const upcomingRecalls = allRecalls.filter(recall => {
      if (recall.status === 'completed' || recall.status === 'closed' || recall.status === 'cancelled') {
        return false;
      }
      if (!recall.deadline_date) {
        return false;
      }
      const deadline = dayjs(recall.deadline_date);
      return deadline.isAfter(todayStr) && deadline.isBefore(threeDaysLater) || deadline.isSame(todayStr, 'day');
    }).map(recall => ({
      id: recall.id,
      recall_code: recall.recall_code,
      deadline_date: recall.deadline_date,
      status: recall.status,
      manufacturer: recall.manufacturer,
      days_until_deadline: dayjs(recall.deadline_date).diff(today, 'day')
    }));
    
    return {
      total: upcomingWorkOrders.length + upcomingRecalls.length,
      work_orders: upcomingWorkOrders,
      recalls: upcomingRecalls
    };
    
  } catch (error) {
    throw new Error(`获取即将逾期项目失败: ${error.message}`);
  }
}

/**
 * 获取高风险项目（严重和高风险）
 * @returns {Promise<{work_orders: Array, recalls: Array, total: number}>}
 */
async function getHighRiskItems() {
  try {
    // 获取未解决的风险记录
    const unresolvedRisks = await models.overdueRisk.getUnresolvedOverdueRisks();
    
    const highRiskRisks = unresolvedRisks.filter(
      risk => risk.risk_level === RISK_LEVELS.HIGH || risk.risk_level === RISK_LEVELS.CRITICAL
    );
    
    const workOrderRisks = highRiskRisks.filter(risk => risk.entity_type === 'work_order');
    const recallRisks = highRiskRisks.filter(risk => risk.entity_type === 'recall');
    
    // 获取详细信息
    const workOrderDetails = [];
    for (const risk of workOrderRisks) {
      const workOrder = await models.workOrder.getWorkOrderById(risk.entity_id);
      if (workOrder) {
        workOrderDetails.push({
          ...risk,
          work_order_code: workOrder.order_code,
          assigned_to: workOrder.assigned_to,
          status: workOrder.status
        });
      }
    }
    
    const recallDetails = [];
    for (const risk of recallRisks) {
      const recall = await models.recall.getRecallById(risk.entity_id);
      if (recall) {
        recallDetails.push({
          ...risk,
          recall_code: recall.recall_code,
          manufacturer: recall.manufacturer,
          status: recall.status
        });
      }
    }
    
    return {
      total: workOrderDetails.length + recallDetails.length,
      work_orders: workOrderDetails,
      recalls: recallDetails
    };
    
  } catch (error) {
    throw new Error(`获取高风险项目失败: ${error.message}`);
  }
}

/**
 * 解决风险记录
 * @param {string} entityType - 实体类型
 * @param {string} entityId - 实体ID
 * @param {string} resolvedDate - 解决日期（可选）
 * @returns {Promise<Object>}
 */
async function resolveRisk(entityType, entityId, resolvedDate = null) {
  try {
    const risk = await models.overdueRisk.getOverdueRiskByEntity(entityType, entityId);
    
    if (!risk) {
      return {
        success: false,
        error: '风险记录不存在'
      };
    }
    
    if (risk.is_resolved) {
      return {
        success: false,
        error: '风险记录已解决'
      };
    }
    
    await models.overdueRisk.markAsResolved(risk.id, resolvedDate);
    
    return {
      success: true,
      message: '风险记录已标记为已解决',
      risk: {
        id: risk.id,
        entity_type: risk.entity_type,
        entity_id: risk.entity_id,
        resolved_date: resolvedDate || dayjs().format('YYYY-MM-DD')
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取风险统计信息
 * @returns {Promise<Object>}
 */
async function getRiskStatistics() {
  try {
    const stats = await models.overdueRisk.getOverdueRiskStats();
    const highRiskItems = await getHighRiskItems();
    const upcomingDeadlines = await getUpcomingDeadlines();
    
    return {
      timestamp: new Date().toISOString(),
      overall: stats,
      high_risk: highRiskItems,
      upcoming_deadlines: upcomingDeadlines,
      risk_levels: RISK_LEVELS,
      risk_thresholds: RISK_THRESHOLDS,
      risk_descriptions: RISK_DESCRIPTIONS
    };
    
  } catch (error) {
    throw new Error(`获取风险统计失败: ${error.message}`);
  }
}

module.exports = {
  RISK_LEVELS,
  RISK_THRESHOLDS,
  RISK_DESCRIPTIONS,
  calculateDaysOverdue,
  evaluateRiskLevel,
  calculateWorkOrderRisk,
  calculateRecallRisk,
  scanWorkOrdersForRisk,
  scanRecallsForRisk,
  performFullRiskScan,
  getUpcomingDeadlines,
  getHighRiskItems,
  resolveRisk,
  getRiskStatistics
};
