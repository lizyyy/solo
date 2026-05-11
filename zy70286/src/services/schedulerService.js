const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');

const RESURFACING_DURATION_MINUTES = 15;
const RECOVERY_DURATION_MINUTES = 30;

function parseTime(timeStr) {
  return new Date(timeStr).getTime();
}

function formatTime(ts) {
  return new Date(ts).toISOString();
}

function timeOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

function getEventsForRink(rinkId, data) {
  const events = [];
  
  data.courses
    .filter(c => c.rinkId === rinkId)
    .forEach(c => {
      events.push({
        id: c.id,
        type: 'course',
        name: c.name,
        startTime: parseTime(c.startTime),
        endTime: parseTime(c.endTime),
        priority: c.priority === 'high' ? 100 : 50
      });
    });
  
  data.competitions
    .filter(c => c.rinkId === rinkId)
    .forEach(c => {
      events.push({
        id: c.id,
        type: 'competition',
        name: c.name,
        startTime: parseTime(c.startTime),
        endTime: parseTime(c.endTime),
        priority: c.priority === 'high' ? 200 : 150
      });
    });
  
  data.iceMaintenance
    .filter(m => m.rinkId === rinkId)
    .forEach(m => {
      const recoveryEnd = parseTime(m.endTime) + (m.recoveryHours * 60 * 60 * 1000);
      events.push({
        id: m.id,
        type: 'maintenance',
        name: m.name,
        startTime: parseTime(m.startTime),
        endTime: recoveryEnd,
        priority: 300
      });
    });
  
  data.resurfacingTasks
    .filter(t => t.rinkId === rinkId && t.status !== 'cancelled')
    .forEach(t => {
      events.push({
        id: t.id,
        type: 'resurfacing',
        name: `磨冰 - ${t.id.substring(0, 8)}`,
        startTime: parseTime(t.startTime),
        endTime: parseTime(t.endTime) + (RECOVERY_DURATION_MINUTES * 60 * 1000),
        priority: 75
      });
    });
  
  return events.sort((a, b) => a.startTime - b.startTime);
}

function checkConflicts(rinkId, taskStartTime, taskEndTime, excludeTaskId = null, data) {
  const conflicts = [];
  const events = getEventsForRink(rinkId, data);
  
  for (const event of events) {
    if (event.type === 'resurfacing' && excludeTaskId && event.id === excludeTaskId) {
      continue;
    }
    
    if (timeOverlap(taskStartTime, taskEndTime, event.startTime, event.endTime)) {
      conflicts.push({
        eventType: event.type,
        eventName: event.name,
        eventId: event.id,
        eventStartTime: formatTime(event.startTime),
        eventEndTime: formatTime(event.endTime)
      });
    }
  }
  
  return conflicts;
}

function validateCreateTask(params) {
  const errors = [];
  
  if (!params.rinkId) {
    errors.push({ field: 'rinkId', message: '冰场 ID 不能为空' });
  }
  
  if (!params.startTime) {
    errors.push({ field: 'startTime', message: '开始时间不能为空' });
  }
  
  if (!params.reason) {
    errors.push({ field: 'reason', message: '磨冰原因不能为空' });
  }
  
  try {
    const start = parseTime(params.startTime);
    if (isNaN(start)) {
      errors.push({ field: 'startTime', message: '开始时间格式无效，应为 ISO 8601 格式' });
    }
  } catch (e) {
    errors.push({ field: 'startTime', message: '开始时间格式无效' });
  }
  
  if (params.requestedBy && typeof params.requestedBy !== 'string') {
    errors.push({ field: 'requestedBy', message: '请求人格式无效' });
  }
  
  return errors;
}

function checkIdempotency(idempotencyKey, data) {
  if (!idempotencyKey) return null;
  return data.idempotencyKeys[idempotencyKey] || null;
}

function recordIdempotency(idempotencyKey, taskId, data) {
  if (!idempotencyKey) return data;
  data.idempotencyKeys[idempotencyKey] = {
    taskId,
    timestamp: formatTime(Date.now())
  };
  return data;
}

function createResurfacingTask(params, idempotencyKey = null) {
  let data = store.readData();
  
  const validationErrors = validateCreateTask(params);
  if (validationErrors.length > 0) {
    return {
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: '请求参数校验失败',
      details: validationErrors
    };
  }
  
  if (idempotencyKey) {
    const existing = checkIdempotency(idempotencyKey, data);
    if (existing) {
      const task = data.resurfacingTasks.find(t => t.id === existing.taskId);
      return {
        success: true,
        data: buildTaskResponse(task, data),
        fromIdempotency: true
      };
    }
  }
  
  const rink = data.iceRinks.find(r => r.id === params.rinkId);
  if (!rink) {
    return {
      success: false,
      errorCode: 'RINK_NOT_FOUND',
      message: `冰场 ${params.rinkId} 不存在`
    };
  }
  
  if (rink.status !== 'active') {
    return {
      success: false,
      errorCode: 'RINK_INACTIVE',
      message: `冰场 ${rink.name} 当前不可用`
    };
  }
  
  const startTime = parseTime(params.startTime);
  const endTime = startTime + (RESURFACING_DURATION_MINUTES * 60 * 1000);
  
  const conflicts = checkConflicts(params.rinkId, startTime, endTime, null, data);
  if (conflicts.length > 0) {
    const highPriorityConflict = conflicts.find(c => 
      c.eventType === 'competition' || c.eventType === 'maintenance'
    );
    
    if (highPriorityConflict) {
      return {
        success: false,
        errorCode: 'HIGH_PRIORITY_CONFLICT',
        message: `磨冰时间与高优先级事件冲突：${highPriorityConflict.eventName}`,
        details: conflicts
      };
    }
    
    return {
      success: false,
      errorCode: 'SCHEDULE_CONFLICT',
      message: '磨冰时间与已有安排冲突',
      details: conflicts
    };
  }
  
  const task = {
    id: `task-${uuidv4()}`,
    rinkId: params.rinkId,
    rinkName: rink.name,
    startTime: formatTime(startTime),
    endTime: formatTime(endTime),
    recoveryEndTime: formatTime(endTime + (RECOVERY_DURATION_MINUTES * 60 * 1000)),
    status: 'pending',
    reason: params.reason,
    requestedBy: params.requestedBy || 'system',
    createdAt: formatTime(Date.now()),
    updatedAt: formatTime(Date.now()),
    history: [
      {
        action: 'created',
        timestamp: formatTime(Date.now()),
        note: `任务已创建，磨冰时长 ${RESURFACING_DURATION_MINUTES} 分钟，恢复时长 ${RECOVERY_DURATION_MINUTES} 分钟`
      }
    ]
  };
  
  data.resurfacingTasks.push(task);
  data = recordIdempotency(idempotencyKey, task.id, data);
  store.writeData(data);
  
  return {
    success: true,
    data: buildTaskResponse(task, data)
  };
}

function advanceTask(taskId) {
  const data = store.readData();
  const task = data.resurfacingTasks.find(t => t.id === taskId);
  
  if (!task) {
    return {
      success: false,
      errorCode: 'TASK_NOT_FOUND',
      message: `磨冰任务 ${taskId} 不存在`
    };
  }
  
  const validTransitions = {
    'pending': ['in_progress'],
    'in_progress': ['completed'],
    'completed': [],
    'cancelled': [],
    'revised': ['in_progress']
  };
  
  const nextStatus = validTransitions[task.status]?.[0];
  if (!nextStatus) {
    return {
      success: false,
      errorCode: 'INVALID_TRANSITION',
      message: `无法推进任务，当前状态：${task.status}`
    };
  }
  
  const previousStatus = task.status;
  task.status = nextStatus;
  task.updatedAt = formatTime(Date.now());
  task.history.push({
    action: 'advanced',
    previousStatus,
    newStatus: nextStatus,
    timestamp: formatTime(Date.now())
  });
  
  if (nextStatus === 'completed') {
    task.completedAt = formatTime(Date.now());
  }
  
  store.writeData(data);
  
  return {
    success: true,
    data: buildTaskResponse(task, data)
  };
}

function cancelTask(taskId, reason) {
  const data = store.readData();
  const task = data.resurfacingTasks.find(t => t.id === taskId);
  
  if (!task) {
    return {
      success: false,
      errorCode: 'TASK_NOT_FOUND',
      message: `磨冰任务 ${taskId} 不存在`
    };
  }
  
  if (task.status === 'completed') {
    return {
      success: false,
      errorCode: 'TASK_COMPLETED',
      message: '已完成的任务无法撤回'
    };
  }
  
  if (task.status === 'cancelled') {
    return {
      success: true,
      data: buildTaskResponse(task, data),
      alreadyCancelled: true
    };
  }
  
  const previousStatus = task.status;
  task.status = 'cancelled';
  task.cancelledAt = formatTime(Date.now());
  task.cancellationReason = reason || '手动撤回';
  task.updatedAt = formatTime(Date.now());
  task.history.push({
    action: 'cancelled',
    previousStatus,
    reason: reason || '手动撤回',
    timestamp: formatTime(Date.now())
  });
  
  store.writeData(data);
  
  return {
    success: true,
    data: buildTaskResponse(task, data)
  };
}

function reviseTask(taskId, updates) {
  const data = store.readData();
  const task = data.resurfacingTasks.find(t => t.id === taskId);
  
  if (!task) {
    return {
      success: false,
      errorCode: 'TASK_NOT_FOUND',
      message: `磨冰任务 ${taskId} 不存在`
    };
  }
  
  if (task.status === 'completed') {
    return {
      success: false,
      errorCode: 'TASK_COMPLETED',
      message: '已完成的任务无法修正'
    };
  }
  
  if (task.status === 'cancelled') {
    return {
      success: false,
      errorCode: 'TASK_CANCELLED',
      message: '已取消的任务无法修正'
    };
  }
  
  const originalStartTime = parseTime(task.startTime);
  const originalEndTime = parseTime(task.endTime);
  
  let newStartTime = originalStartTime;
  let newEndTime = originalEndTime;
  
  if (updates.startTime) {
    try {
      newStartTime = parseTime(updates.startTime);
      if (isNaN(newStartTime)) {
        return {
          success: false,
          errorCode: 'VALIDATION_ERROR',
          message: '开始时间格式无效'
        };
      }
      newEndTime = newStartTime + (RESURFACING_DURATION_MINUTES * 60 * 1000);
    } catch (e) {
      return {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: '开始时间格式无效'
      };
    }
  }
  
  if (updates.startTime) {
    const conflicts = checkConflicts(task.rinkId, newStartTime, newEndTime, task.id, data);
    if (conflicts.length > 0) {
      const highPriorityConflict = conflicts.find(c => 
        c.eventType === 'competition' || c.eventType === 'maintenance'
      );
      
      if (highPriorityConflict) {
        return {
          success: false,
          errorCode: 'HIGH_PRIORITY_CONFLICT',
          message: `修正后的磨冰时间与高优先级事件冲突：${highPriorityConflict.eventName}`,
          details: conflicts
        };
      }
      
      return {
        success: false,
        errorCode: 'SCHEDULE_CONFLICT',
        message: '修正后的磨冰时间与已有安排冲突',
        details: conflicts
      };
    }
    
    task.startTime = formatTime(newStartTime);
    task.endTime = formatTime(newEndTime);
    task.recoveryEndTime = formatTime(newEndTime + (RECOVERY_DURATION_MINUTES * 60 * 1000));
  }
  
  if (updates.reason) {
    task.reason = updates.reason;
  }
  
  if (updates.requestedBy) {
    task.requestedBy = updates.requestedBy;
  }
  
  const previousStatus = task.status;
  if (task.status === 'in_progress') {
    task.status = 'revised';
  }
  task.updatedAt = formatTime(Date.now());
  task.history.push({
    action: 'revised',
    previousStatus,
    newStatus: task.status,
    changes: {
      ...(updates.startTime ? { startTime: { from: formatTime(originalStartTime), to: formatTime(newStartTime) } } : {}),
      ...(updates.reason ? { reason: task.reason } : {}),
      ...(updates.requestedBy ? { requestedBy: task.requestedBy } : {})
    },
    timestamp: formatTime(Date.now())
  });
  
  store.writeData(data);
  
  return {
    success: true,
    data: buildTaskResponse(task, data)
  };
}

function getTaskDetail(taskId) {
  const data = store.readData();
  const task = data.resurfacingTasks.find(t => t.id === taskId);
  
  if (!task) {
    return {
      success: false,
      errorCode: 'TASK_NOT_FOUND',
      message: `磨冰任务 ${taskId} 不存在`
    };
  }
  
  return {
    success: true,
    data: buildTaskResponse(task, data)
  };
}

function getTaskSummary(query = {}) {
  const data = store.readData();
  let tasks = [...data.resurfacingTasks];
  
  if (query.rinkId) {
    tasks = tasks.filter(t => t.rinkId === query.rinkId);
  }
  
  if (query.status) {
    tasks = tasks.filter(t => t.status === query.status);
  }
  
  if (query.startDate) {
    const start = parseTime(query.startDate);
    tasks = tasks.filter(t => parseTime(t.startTime) >= start);
  }
  
  if (query.endDate) {
    const end = parseTime(query.endDate);
    tasks = tasks.filter(t => parseTime(t.startTime) <= end);
  }
  
  tasks.sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  
  const stats = {
    total: tasks.length,
    byStatus: {
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      revised: tasks.filter(t => t.status === 'revised').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    },
    byRink: {}
  };
  
  tasks.forEach(t => {
    if (!stats.byRink[t.rinkId]) {
      stats.byRink[t.rinkId] = { name: t.rinkName, count: 0 };
    }
    stats.byRink[t.rinkId].count++;
  });
  
  const recoveryWindows = tasks
    .filter(t => t.status !== 'cancelled')
    .map(t => ({
      taskId: t.id,
      rinkId: t.rinkId,
      rinkName: t.rinkName,
      resurfacingStartTime: t.startTime,
      resurfacingEndTime: t.endTime,
      recoveryStartTime: t.endTime,
      recoveryEndTime: t.recoveryEndTime,
      status: t.status
    }));
  
  return {
    success: true,
    data: {
      tasks: tasks.map(t => buildTaskResponse(t, data)),
      stats,
      recoveryWindows
    }
  };
}

function getRinkSchedule(rinkId, date) {
  const data = store.readData();
  
  const rink = data.iceRinks.find(r => r.id === rinkId);
  if (!rink) {
    return {
      success: false,
      errorCode: 'RINK_NOT_FOUND',
      message: `冰场 ${rinkId} 不存在`
    };
  }
  
  const events = getEventsForRink(rinkId, data);
  let filteredEvents = events;
  
  if (date) {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setHours(23, 59, 59, 999);
    
    filteredEvents = events.filter(e => 
      timeOverlap(e.startTime, e.endTime, dateStart.getTime(), dateEnd.getTime())
    );
  }
  
  return {
    success: true,
    data: {
      rink: { id: rink.id, name: rink.name, status: rink.status },
      events: filteredEvents.map(e => ({
        ...e,
        startTime: formatTime(e.startTime),
        endTime: formatTime(e.endTime)
      }))
    }
  };
}

function buildTaskResponse(task, data) {
  const rink = data.iceRinks.find(r => r.id === task.rinkId);
  
  const conflictCheckStart = parseTime(task.startTime);
  const conflictCheckEnd = parseTime(task.recoveryEndTime);
  const conflicts = checkConflicts(task.rinkId, conflictCheckStart, conflictCheckEnd, task.id, data);
  
  return {
    id: task.id,
    rink: {
      id: task.rinkId,
      name: rink?.name || task.rinkName
    },
    schedule: {
      resurfacingStartTime: task.startTime,
      resurfacingEndTime: task.endTime,
      recoveryStartTime: task.endTime,
      recoveryEndTime: task.recoveryEndTime
    },
    status: task.status,
    reason: task.reason,
    requestedBy: task.requestedBy,
    meta: {
      resurfacingDurationMinutes: RESURFACING_DURATION_MINUTES,
      recoveryDurationMinutes: RECOVERY_DURATION_MINUTES
    },
    recoveryEvidence: {
      windowStart: task.endTime,
      windowEnd: task.recoveryEndTime,
      durationMinutes: RECOVERY_DURATION_MINUTES,
      conflictsDuringRecovery: conflicts.length > 0 ? conflicts : null
    },
    history: task.history,
    timestamps: {
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt || null,
      cancelledAt: task.cancelledAt || null
    }
  };
}

module.exports = {
  createResurfacingTask,
  advanceTask,
  cancelTask,
  reviseTask,
  getTaskDetail,
  getTaskSummary,
  getRinkSchedule,
  RESURFACING_DURATION_MINUTES,
  RECOVERY_DURATION_MINUTES
};
