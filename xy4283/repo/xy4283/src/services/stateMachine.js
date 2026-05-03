const models = require('../models');
const dayjs = require('dayjs');

/**
 * 状态机服务
 * 处理派工单和召回匹配的状态流转逻辑
 */

// 派工单状态定义
const WORK_ORDER_STATES = {
  CREATED: 'created',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// 召回匹配状态定义
const RECALL_MATCH_STATES = {
  PENDING: 'pending',
  NOTIFIED: 'notified',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// 派工单状态流转规则
const WORK_ORDER_TRANSITIONS = {
  [WORK_ORDER_STATES.CREATED]: {
    allowed: [WORK_ORDER_STATES.ASSIGNED, WORK_ORDER_STATES.CANCELLED],
    actions: {
      [WORK_ORDER_STATES.ASSIGNED]: 'assign',
      [WORK_ORDER_STATES.CANCELLED]: 'cancel'
    }
  },
  [WORK_ORDER_STATES.ASSIGNED]: {
    allowed: [WORK_ORDER_STATES.IN_PROGRESS, WORK_ORDER_STATES.CANCELLED],
    actions: {
      [WORK_ORDER_STATES.IN_PROGRESS]: 'start',
      [WORK_ORDER_STATES.CANCELLED]: 'cancel'
    }
  },
  [WORK_ORDER_STATES.IN_PROGRESS]: {
    allowed: [WORK_ORDER_STATES.COMPLETED, WORK_ORDER_STATES.CANCELLED],
    actions: {
      [WORK_ORDER_STATES.COMPLETED]: 'complete',
      [WORK_ORDER_STATES.CANCELLED]: 'cancel'
    }
  },
  [WORK_ORDER_STATES.COMPLETED]: {
    allowed: [],
    actions: {}
  },
  [WORK_ORDER_STATES.CANCELLED]: {
    allowed: [],
    actions: {}
  }
};

// 召回匹配状态流转规则
const RECALL_MATCH_TRANSITIONS = {
  [RECALL_MATCH_STATES.PENDING]: {
    allowed: [RECALL_MATCH_STATES.NOTIFIED, RECALL_MATCH_STATES.CANCELLED],
    actions: {
      [RECALL_MATCH_STATES.NOTIFIED]: 'notify',
      [RECALL_MATCH_STATES.CANCELLED]: 'cancel'
    }
  },
  [RECALL_MATCH_STATES.NOTIFIED]: {
    allowed: [RECALL_MATCH_STATES.ASSIGNED, RECALL_MATCH_STATES.CANCELLED],
    actions: {
      [RECALL_MATCH_STATES.ASSIGNED]: 'assign',
      [RECALL_MATCH_STATES.CANCELLED]: 'cancel'
    }
  },
  [RECALL_MATCH_STATES.ASSIGNED]: {
    allowed: [RECALL_MATCH_STATES.IN_PROGRESS, RECALL_MATCH_STATES.CANCELLED],
    actions: {
      [RECALL_MATCH_STATES.IN_PROGRESS]: 'start',
      [RECALL_MATCH_STATES.CANCELLED]: 'cancel'
    }
  },
  [RECALL_MATCH_STATES.IN_PROGRESS]: {
    allowed: [RECALL_MATCH_STATES.COMPLETED, RECALL_MATCH_STATES.CANCELLED],
    actions: {
      [RECALL_MATCH_STATES.COMPLETED]: 'complete',
      [RECALL_MATCH_STATES.CANCELLED]: 'cancel'
    }
  },
  [RECALL_MATCH_STATES.COMPLETED]: {
    allowed: [],
    actions: {}
  },
  [RECALL_MATCH_STATES.CANCELLED]: {
    allowed: [],
    actions: {}
  }
};

/**
 * 检查状态转换是否允许
 * @param {string} fromState - 源状态
 * @param {string} toState - 目标状态
 * @param {string} entityType - 实体类型 ('work_order' 或 'recall_match')
 * @returns {boolean} 是否允许转换
 */
function canTransition(fromState, toState, entityType = 'work_order') {
  const transitions = entityType === 'recall_match' 
    ? RECALL_MATCH_TRANSITIONS 
    : WORK_ORDER_TRANSITIONS;
  
  const stateConfig = transitions[fromState];
  if (!stateConfig) {
    return false;
  }
  
  return stateConfig.allowed.includes(toState);
}

/**
 * 获取允许的目标状态列表
 * @param {string} currentState - 当前状态
 * @param {string} entityType - 实体类型
 * @returns {Array} 允许的目标状态
 */
function getAllowedTransitions(currentState, entityType = 'work_order') {
  const transitions = entityType === 'recall_match' 
    ? RECALL_MATCH_TRANSITIONS 
    : WORK_ORDER_TRANSITIONS;
  
  const stateConfig = transitions[currentState];
  if (!stateConfig) {
    return [];
  }
  
  return stateConfig.allowed;
}

/**
 * 执行派工单状态转换
 * @param {string} workOrderId - 派工单ID
 * @param {string} toState - 目标状态
 * @param {Object} options - 选项
 * @param {string} options.changedBy - 变更人
 * @param {string} options.changeReason - 变更原因
 * @param {string} options.assignedTo - 分配给（分配时使用）
 * @param {string} options.completionDate - 完成日期（完成时使用）
 * @returns {Promise<Object>} 更新后的派工单
 */
async function transitionWorkOrder(workOrderId, toState, options = {}) {
  try {
    // 1. 获取当前派工单
    const workOrder = await models.workOrder.getWorkOrderById(workOrderId);
    
    if (!workOrder) {
      throw new Error(`派工单不存在: ${workOrderId}`);
    }
    
    const fromState = workOrder.status;
    
    // 2. 检查状态转换是否允许
    if (!canTransition(fromState, toState, 'work_order')) {
      throw new Error(`状态转换不允许: ${fromState} -> ${toState}`);
    }
    
    // 3. 准备更新数据
    const updateData = { status: toState };
    let changeReason = options.changeReason || '';
    
    // 根据目标状态执行特定逻辑
    switch (toState) {
      case WORK_ORDER_STATES.ASSIGNED:
        if (!options.assignedTo) {
          throw new Error('分配状态时必须指定分配人');
        }
        updateData.assigned_to = options.assignedTo;
        updateData.assigned_date = dayjs().format('YYYY-MM-DD');
        changeReason = changeReason || `派工单分配给: ${options.assignedTo}`;
        
        // 同时更新召回匹配状态
        if (workOrder.recall_match_id) {
          await transitionRecallMatch(
            workOrder.recall_match_id,
            RECALL_MATCH_STATES.ASSIGNED,
            {
              changedBy: options.changedBy,
              changeReason: `派工单已分配: ${workOrder.order_code}`
            }
          );
        }
        break;
        
      case WORK_ORDER_STATES.IN_PROGRESS:
        changeReason = changeReason || '开始处理派工单';
        
        // 同时更新召回匹配状态
        if (workOrder.recall_match_id) {
          await transitionRecallMatch(
            workOrder.recall_match_id,
            RECALL_MATCH_STATES.IN_PROGRESS,
            {
              changedBy: options.changedBy,
              changeReason: `派工单开始处理: ${workOrder.order_code}`
            }
          );
        }
        break;
        
      case WORK_ORDER_STATES.COMPLETED:
        updateData.actual_completion_date = options.completionDate || dayjs().format('YYYY-MM-DD');
        changeReason = changeReason || '派工单完成';
        
        // 同时更新召回匹配状态
        if (workOrder.recall_match_id) {
          await transitionRecallMatch(
            workOrder.recall_match_id,
            RECALL_MATCH_STATES.COMPLETED,
            {
              changedBy: options.changedBy,
              changeReason: `派工单完成: ${workOrder.order_code}`
            }
          );
        }
        break;
        
      case WORK_ORDER_STATES.CANCELLED:
        changeReason = changeReason || '派工单取消';
        break;
    }
    
    // 4. 更新派工单状态
    const updatedWorkOrder = await models.workOrder.updateWorkOrder(workOrderId, updateData);
    
    // 5. 记录状态历史
    await models.statusHistory.createStatusHistory({
      entity_type: 'work_order',
      entity_id: workOrderId,
      from_status: fromState,
      to_status: toState,
      changed_by: options.changedBy || null,
      change_reason: changeReason
    });
    
    return {
      success: true,
      work_order: updatedWorkOrder,
      transition: {
        from: fromState,
        to: toState,
        changed_by: options.changedBy,
        change_reason: changeReason,
        timestamp: new Date().toISOString()
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
 * 执行召回匹配状态转换
 * @param {string} recallMatchId - 召回匹配ID
 * @param {string} toState - 目标状态
 * @param {Object} options - 选项
 * @param {string} options.changedBy - 变更人
 * @param {string} options.changeReason - 变更原因
 * @returns {Promise<Object>} 更新后的召回匹配
 */
async function transitionRecallMatch(recallMatchId, toState, options = {}) {
  try {
    // 1. 获取当前召回匹配
    const recallMatch = await models.recallMatch.getRecallMatchById(recallMatchId);
    
    if (!recallMatch) {
      throw new Error(`召回匹配不存在: ${recallMatchId}`);
    }
    
    const fromState = recallMatch.status;
    
    // 2. 检查状态转换是否允许
    if (!canTransition(fromState, toState, 'recall_match')) {
      // 某些状态可以跳过，比如从 notified 直接到 in_progress
      // 检查是否是合理的跳过
      const allowedSkips = [
        { from: RECALL_MATCH_STATES.NOTIFIED, to: RECALL_MATCH_STATES.IN_PROGRESS },
        { from: RECALL_MATCH_STATES.NOTIFIED, to: RECALL_MATCH_STATES.COMPLETED }
      ];
      
      const isAllowedSkip = allowedSkips.some(
        skip => skip.from === fromState && skip.to === toState
      );
      
      if (!isAllowedSkip) {
        throw new Error(`状态转换不允许: ${fromState} -> ${toState}`);
      }
    }
    
    // 3. 准备更新数据
    const updateData = { status: toState };
    let changeReason = options.changeReason || '';
    
    // 根据目标状态执行特定逻辑
    switch (toState) {
      case RECALL_MATCH_STATES.NOTIFIED:
        updateData.is_notified = 1;
        updateData.notified_date = dayjs().format('YYYY-MM-DD');
        changeReason = changeReason || '召回通知已发送';
        break;
        
      case RECALL_MATCH_STATES.COMPLETED:
        changeReason = changeReason || '召回整改完成';
        break;
        
      case RECALL_MATCH_STATES.CANCELLED:
        changeReason = changeReason || '召回匹配取消';
        break;
    }
    
    // 4. 更新召回匹配状态
    const updatedRecallMatch = await models.recallMatch.updateRecallMatch(recallMatchId, updateData);
    
    // 5. 记录状态历史
    await models.statusHistory.createStatusHistory({
      entity_type: 'recall_match',
      entity_id: recallMatchId,
      from_status: fromState,
      to_status: toState,
      changed_by: options.changedBy || null,
      change_reason: changeReason
    });
    
    return {
      success: true,
      recall_match: updatedRecallMatch,
      transition: {
        from: fromState,
        to: toState,
        changed_by: options.changedBy,
        change_reason: changeReason,
        timestamp: new Date().toISOString()
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
 * 分配派工单
 * @param {string} workOrderId - 派工单ID
 * @param {string} assignedTo - 分配人
 * @param {string} changedBy - 操作人
 * @returns {Promise<Object>}
 */
async function assignWorkOrder(workOrderId, assignedTo, changedBy = null) {
  return transitionWorkOrder(workOrderId, WORK_ORDER_STATES.ASSIGNED, {
    assignedTo,
    changedBy,
    changeReason: `派工单分配给: ${assignedTo}`
  });
}

/**
 * 开始处理派工单
 * @param {string} workOrderId - 派工单ID
 * @param {string} changedBy - 操作人
 * @returns {Promise<Object>}
 */
async function startWorkOrder(workOrderId, changedBy = null) {
  return transitionWorkOrder(workOrderId, WORK_ORDER_STATES.IN_PROGRESS, {
    changedBy,
    changeReason: '开始处理派工单'
  });
}

/**
 * 完成派工单
 * @param {string} workOrderId - 派工单ID
 * @param {string} completionDate - 完成日期
 * @param {string} changedBy - 操作人
 * @returns {Promise<Object>}
 */
async function completeWorkOrder(workOrderId, completionDate = null, changedBy = null) {
  return transitionWorkOrder(workOrderId, WORK_ORDER_STATES.COMPLETED, {
    completionDate,
    changedBy,
    changeReason: '派工单完成'
  });
}

/**
 * 取消派工单
 * @param {string} workOrderId - 派工单ID
 * @param {string} reason - 取消原因
 * @param {string} changedBy - 操作人
 * @returns {Promise<Object>}
 */
async function cancelWorkOrder(workOrderId, reason = '', changedBy = null) {
  return transitionWorkOrder(workOrderId, WORK_ORDER_STATES.CANCELLED, {
    changedBy,
    changeReason: reason || '派工单取消'
  });
}

/**
 * 标记召回匹配为已通知
 * @param {string} recallMatchId - 召回匹配ID
 * @param {string} changedBy - 操作人
 * @returns {Promise<Object>}
 */
async function notifyRecallMatch(recallMatchId, changedBy = null) {
  return transitionRecallMatch(recallMatchId, RECALL_MATCH_STATES.NOTIFIED, {
    changedBy,
    changeReason: '召回通知已发送'
  });
}

/**
 * 获取实体的状态历史
 * @param {string} entityType - 实体类型
 * @param {string} entityId - 实体ID
 * @returns {Promise<Array>} 状态历史列表
 */
async function getStatusHistory(entityType, entityId) {
  return await models.statusHistory.getStatusHistoryByEntity(entityType, entityId);
}

/**
 * 获取实体的当前状态
 * @param {string} entityType - 实体类型
 * @param {string} entityId - 实体ID
 * @returns {Promise<Object|null>} 当前状态信息
 */
async function getCurrentStatus(entityType, entityId) {
  return await models.statusHistory.getCurrentStatus(entityType, entityId);
}

/**
 * 验证状态流转图
 * @returns {Object} 状态流转图说明
 */
function getStateMachineDefinition() {
  return {
    work_order: {
      states: Object.values(WORK_ORDER_STATES),
      transitions: WORK_ORDER_TRANSITIONS,
      description: {
        [WORK_ORDER_STATES.CREATED]: '已创建 - 派工单刚创建，等待分配',
        [WORK_ORDER_STATES.ASSIGNED]: '已分配 - 已分配给处理人员',
        [WORK_ORDER_STATES.IN_PROGRESS]: '处理中 - 正在进行整改',
        [WORK_ORDER_STATES.COMPLETED]: '已完成 - 整改完成',
        [WORK_ORDER_STATES.CANCELLED]: '已取消 - 派工单取消'
      }
    },
    recall_match: {
      states: Object.values(RECALL_MATCH_STATES),
      transitions: RECALL_MATCH_TRANSITIONS,
      description: {
        [RECALL_MATCH_STATES.PENDING]: '待处理 - 匹配成功，等待通知',
        [RECALL_MATCH_STATES.NOTIFIED]: '已通知 - 已通知相关人员',
        [RECALL_MATCH_STATES.ASSIGNED]: '已分配 - 已分配派工单',
        [RECALL_MATCH_STATES.IN_PROGRESS]: '处理中 - 正在整改',
        [RECALL_MATCH_STATES.COMPLETED]: '已完成 - 整改完成',
        [RECALL_MATCH_STATES.CANCELLED]: '已取消 - 取消处理'
      }
    }
  };
}

module.exports = {
  WORK_ORDER_STATES,
  RECALL_MATCH_STATES,
  canTransition,
  getAllowedTransitions,
  transitionWorkOrder,
  transitionRecallMatch,
  assignWorkOrder,
  startWorkOrder,
  completeWorkOrder,
  cancelWorkOrder,
  notifyRecallMatch,
  getStatusHistory,
  getCurrentStatus,
  getStateMachineDefinition
};
