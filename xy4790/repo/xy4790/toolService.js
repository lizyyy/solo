const db = require('./database');

const TOOL_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  BORROWED: 'BORROWED',
  UNDER_REPAIR: 'UNDER_REPAIR'
};

const ACTIONS = {
  RESERVE: 'RESERVE',
  CANCEL_RESERVATION: 'CANCEL_RESERVATION',
  BORROW: 'BORROW',
  RETURN: 'RETURN',
  REPORT_REPAIR: 'REPORT_REPAIR',
  COMPLETE_REPAIR: 'COMPLETE_REPAIR'
};

const STATUS_TRANSITIONS = {
  [TOOL_STATUSES.AVAILABLE]: {
    [ACTIONS.RESERVE]: TOOL_STATUSES.RESERVED,
    [ACTIONS.REPORT_REPAIR]: TOOL_STATUSES.UNDER_REPAIR
  },
  [TOOL_STATUSES.RESERVED]: {
    [ACTIONS.CANCEL_RESERVATION]: TOOL_STATUSES.AVAILABLE,
    [ACTIONS.BORROW]: TOOL_STATUSES.BORROWED,
    [ACTIONS.REPORT_REPAIR]: TOOL_STATUSES.UNDER_REPAIR
  },
  [TOOL_STATUSES.BORROWED]: {
    [ACTIONS.RETURN]: TOOL_STATUSES.AVAILABLE,
    [ACTIONS.REPORT_REPAIR]: TOOL_STATUSES.UNDER_REPAIR
  },
  [TOOL_STATUSES.UNDER_REPAIR]: {
    [ACTIONS.COMPLETE_REPAIR]: TOOL_STATUSES.AVAILABLE
  }
};

const getDisableReasons = {
  [TOOL_STATUSES.AVAILABLE]: {
    [ACTIONS.RESERVE]: null,
    [ACTIONS.CANCEL_RESERVATION]: '工具未被预约',
    [ACTIONS.BORROW]: '需要先预约',
    [ACTIONS.RETURN]: '工具未被借出',
    [ACTIONS.REPORT_REPAIR]: null
  },
  [TOOL_STATUSES.RESERVED]: {
    [ACTIONS.RESERVE]: '工具已被预约',
    [ACTIONS.CANCEL_RESERVATION]: null,
    [ACTIONS.BORROW]: null,
    [ACTIONS.RETURN]: '工具未被借出',
    [ACTIONS.REPORT_REPAIR]: null
  },
  [TOOL_STATUSES.BORROWED]: {
    [ACTIONS.RESERVE]: '工具已被借出',
    [ACTIONS.CANCEL_RESERVATION]: '工具未被预约',
    [ACTIONS.BORROW]: '工具已被借出',
    [ACTIONS.RETURN]: null,
    [ACTIONS.REPORT_REPAIR]: null
  },
  [TOOL_STATUSES.UNDER_REPAIR]: {
    [ACTIONS.RESERVE]: '工具正在维修中',
    [ACTIONS.CANCEL_RESERVATION]: '工具正在维修中',
    [ACTIONS.BORROW]: '工具正在维修中',
    [ACTIONS.RETURN]: '工具正在维修中',
    [ACTIONS.REPORT_REPAIR]: '工具已在维修中',
    [ACTIONS.COMPLETE_REPAIR]: null
  }
};

function getToolById(toolId) {
  return db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId);
}

function getUserById(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function getActiveReservation(toolId) {
  return db.prepare(`
    SELECT r.*, u.name as user_name 
    FROM reservations r 
    JOIN users u ON r.user_id = u.id 
    WHERE r.tool_id = ? AND r.status = 'ACTIVE'
  `).get(toolId);
}

function getActiveBorrow(toolId) {
  return db.prepare(`
    SELECT b.*, u.name as user_name 
    FROM borrow_records b 
    JOIN users u ON b.user_id = u.id 
    WHERE b.tool_id = ? AND b.status = 'BORROWED'
  `).get(toolId);
}

function getOpenRepair(toolId) {
  return db.prepare(`
    SELECT r.*, u.name as reporter_name 
    FROM repair_records r 
    JOIN users u ON r.reporter_id = u.id 
    WHERE r.tool_id = ? AND r.status = 'OPEN'
  `).get(toolId);
}

function logOperation(toolId, userId, action, oldStatus, newStatus, message) {
  db.prepare(`
    INSERT INTO operation_logs (tool_id, user_id, action, old_status, new_status, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(toolId, userId, action, oldStatus, newStatus, message);
}

function canPerformAction(toolStatus, action) {
  const transitions = STATUS_TRANSITIONS[toolStatus];
  return transitions && transitions[action] !== undefined;
}

function getDisableReason(toolStatus, action) {
  const reasons = getDisableReasons[toolStatus];
  return reasons ? reasons[action] || null : null;
}

function getAvailableActions(toolStatus) {
  const transitions = STATUS_TRANSITIONS[toolStatus] || {};
  return Object.keys(transitions);
}

function performAction(toolId, userId, action, description = null) {
  const tool = getToolById(toolId);
  if (!tool) {
    return { success: false, error: '工具不存在' };
  }

  const user = getUserById(userId);
  if (!user) {
    return { success: false, error: '用户不存在' };
  }

  if (!canPerformAction(tool.status, action)) {
    return { 
      success: false, 
      error: `无法执行操作: 当前状态 ${tool.status} 不允许 ${action}`,
      currentTool: tool
    };
  }

  try {
    return db.transaction(() => {
      const currentTool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId);
      
      if (currentTool.version !== tool.version) {
        logOperation(toolId, userId, action, tool.status, currentTool.status, 
          `并发冲突: 工具状态已被其他操作修改`);
        return { 
          success: false, 
          error: '操作失败: 工具状态已被其他操作修改，请刷新页面',
          currentTool: currentTool
        };
      }

      if (!canPerformAction(currentTool.status, action)) {
        return { 
          success: false, 
          error: `无法执行操作: 当前状态 ${currentTool.status} 不允许 ${action}`,
          currentTool: currentTool
        };
      }

      const newStatus = STATUS_TRANSITIONS[currentTool.status][action];
      let result = null;

      switch (action) {
        case ACTIONS.RESERVE:
          result = handleReserve(toolId, userId, currentTool, newStatus);
          break;
        case ACTIONS.CANCEL_RESERVATION:
          result = handleCancelReservation(toolId, userId, currentTool, newStatus);
          break;
        case ACTIONS.BORROW:
          result = handleBorrow(toolId, userId, currentTool, newStatus);
          break;
        case ACTIONS.RETURN:
          result = handleReturn(toolId, userId, currentTool, newStatus);
          break;
        case ACTIONS.REPORT_REPAIR:
          result = handleReportRepair(toolId, userId, currentTool, newStatus, description);
          break;
        case ACTIONS.COMPLETE_REPAIR:
          result = handleCompleteRepair(toolId, userId, currentTool, newStatus);
          break;
      }

      if (!result.success) {
        return result;
      }

      logOperation(toolId, userId, action, currentTool.status, newStatus, result.message);

      return {
        success: true,
        tool: getToolWithDetails(toolId),
        message: result.message
      };
    })();
  } catch (error) {
    console.error('操作失败:', error);
    return { success: false, error: '操作失败: ' + error.message };
  }
}

function handleReserve(toolId, userId, tool, newStatus) {
  const existingReservation = getActiveReservation(toolId);
  if (existingReservation) {
    return { success: false, error: '该工具已有有效预约' };
  }

  db.prepare(`
    UPDATE tools SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).run(newStatus, toolId, tool.version);

  db.prepare(`
    INSERT INTO reservations (tool_id, user_id, status) VALUES (?, ?, 'ACTIVE')
  `).run(toolId, userId);

  return { success: true, message: '预约成功' };
}

function handleCancelReservation(toolId, userId, tool, newStatus) {
  const reservation = getActiveReservation(toolId);
  if (!reservation) {
    return { success: false, error: '该工具没有有效预约' };
  }

  db.prepare(`
    UPDATE tools SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).run(newStatus, toolId, tool.version);

  db.prepare(`
    UPDATE reservations SET status = 'CANCELLED' WHERE id = ?
  `).run(reservation.id);

  return { success: true, message: '取消预约成功' };
}

function handleBorrow(toolId, userId, tool, newStatus) {
  const reservation = getActiveReservation(toolId);
  if (!reservation) {
    return { success: false, error: '该工具没有有效预约，请先预约' };
  }

  if (reservation.user_id !== userId) {
    return { success: false, error: '只能借出自己预约的工具' };
  }

  db.prepare(`
    UPDATE tools SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).run(newStatus, toolId, tool.version);

  db.prepare(`
    UPDATE reservations SET status = 'COMPLETED' WHERE id = ?
  `).run(reservation.id);

  db.prepare(`
    INSERT INTO borrow_records (tool_id, user_id, status) VALUES (?, ?, 'BORROWED')
  `).run(toolId, userId);

  return { success: true, message: '借出成功' };
}

function handleReturn(toolId, userId, tool, newStatus) {
  const borrow = getActiveBorrow(toolId);
  if (!borrow) {
    return { success: false, error: '该工具没有在借记录' };
  }

  db.prepare(`
    UPDATE tools SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).run(newStatus, toolId, tool.version);

  db.prepare(`
    UPDATE borrow_records SET status = 'RETURNED', returned_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(borrow.id);

  return { success: true, message: '归还成功' };
}

function handleReportRepair(toolId, userId, tool, newStatus, description) {
  if (tool.status === TOOL_STATUSES.UNDER_REPAIR) {
    return { success: false, error: '工具已在维修中' };
  }

  const activeReservation = getActiveReservation(toolId);
  const activeBorrow = getActiveBorrow(toolId);

  db.prepare(`
    UPDATE tools SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).run(newStatus, toolId, tool.version);

  if (activeReservation) {
    db.prepare(`
      UPDATE reservations SET status = 'CANCELLED' WHERE id = ?
    `).run(activeReservation.id);
  }

  if (activeBorrow) {
    db.prepare(`
      UPDATE borrow_records SET status = 'RETURNED', returned_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(activeBorrow.id);
  }

  db.prepare(`
    INSERT INTO repair_records (tool_id, reporter_id, description, status) 
    VALUES (?, ?, ?, 'OPEN')
  `).run(toolId, userId, description || '报修');

  return { success: true, message: '报修成功' };
}

function handleCompleteRepair(toolId, userId, tool, newStatus) {
  const repair = getOpenRepair(toolId);
  if (!repair) {
    return { success: false, error: '该工具没有在修记录' };
  }

  db.prepare(`
    UPDATE tools SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).run(newStatus, toolId, tool.version);

  db.prepare(`
    UPDATE repair_records SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(repair.id);

  return { success: true, message: '维修完成' };
}

function getToolWithDetails(toolId) {
  const tool = getToolById(toolId);
  if (!tool) return null;

  return enrichToolWithDetails(tool);
}

function enrichToolWithDetails(tool) {
  const reservation = getActiveReservation(tool.id);
  const borrow = getActiveBorrow(tool.id);
  const repair = getOpenRepair(tool.id);

  const availableActions = getAvailableActions(tool.status);
  const actionDetails = {};
  
  for (const action of Object.values(ACTIONS)) {
    const isAvailable = availableActions.includes(action);
    actionDetails[action] = {
      enabled: isAvailable,
      reason: isAvailable ? null : getDisableReason(tool.status, action)
    };
  }

  return {
    ...tool,
    reservation,
    borrow,
    repair,
    actions: actionDetails
  };
}

function getAllTools() {
  const tools = db.prepare('SELECT * FROM tools ORDER BY id').all();
  return tools.map(tool => enrichToolWithDetails(tool));
}

function getAllUsers() {
  return db.prepare('SELECT * FROM users ORDER BY id').all();
}

function getRecentLogs(limit = 50) {
  return db.prepare(`
    SELECT ol.*, t.name as tool_name, u.name as user_name
    FROM operation_logs ol
    JOIN tools t ON ol.tool_id = t.id
    LEFT JOIN users u ON ol.user_id = u.id
    ORDER BY ol.created_at DESC
    LIMIT ?
  `).all(limit);
}

function getTodayBorrowRecords() {
  return db.prepare(`
    SELECT 
      b.id,
      t.name as tool_name,
      u.name as user_name,
      b.borrowed_at,
      b.returned_at,
      b.status
    FROM borrow_records b
    JOIN tools t ON b.tool_id = t.id
    JOIN users u ON b.user_id = u.id
    WHERE date(b.borrowed_at) = date('now')
    ORDER BY b.borrowed_at DESC
  `).all();
}

function getToolLogs(toolId, limit = 20) {
  return db.prepare(`
    SELECT ol.*, t.name as tool_name, u.name as user_name
    FROM operation_logs ol
    JOIN tools t ON ol.tool_id = t.id
    LEFT JOIN users u ON ol.user_id = u.id
    WHERE ol.tool_id = ?
    ORDER BY ol.created_at DESC
    LIMIT ?
  `).all(toolId, limit);
}

module.exports = {
  TOOL_STATUSES,
  ACTIONS,
  STATUS_TRANSITIONS,
  getToolById,
  getUserById,
  getToolWithDetails,
  getAllTools,
  getAllUsers,
  getRecentLogs,
  getTodayBorrowRecords,
  getToolLogs,
  performAction,
  canPerformAction,
  getDisableReason,
  getAvailableActions,
  enrichToolWithDetails
};
