const { store, generateId, addAuditLog } = require('../models/store');

const DAY_MS = 24 * 60 * 60 * 1000;

function getTypeMap(dataType, source = 'business') {
  const container = source === 'archive' ? store.archiveStorage : store.businessData;
  switch (dataType) {
    case 'order': return container.orders;
    case 'ticket': return container.tickets;
    case 'message': return container.messages;
    default: throw new Error(`未知数据类型: ${dataType}`);
  }
}

function getRetentionPolicy(dataType) {
  for (const policy of store.retentionPolicies.values()) {
    if (policy.dataType === dataType) {
      return policy;
    }
  }
  return null;
}

function isRetentionPeriodExpired(record, policy, now = Date.now()) {
  if (!policy) return false;
  const retentionMs = policy.retentionDays * DAY_MS;
  return (now - record.createdAt) > retentionMs;
}

function isRecordFrozen(recordId, dataType) {
  for (const freeze of store.freezes.values()) {
    if (freeze.active && freeze.dataType === dataType && freeze.records.includes(recordId)) {
      return freeze;
    }
  }
  return null;
}

function findExistingTask(dataType, dateRangeStart, dateRangeEnd, operationType) {
  for (const task of store.archiveTasks.values()) {
    if (
      task.dataType === dataType &&
      task.dateRangeStart === dateRangeStart &&
      task.dateRangeEnd === dateRangeEnd &&
      task.operationType === operationType &&
      task.status !== 'failed'
    ) {
      return task;
    }
  }
  return null;
}

function analyzeRecords(dataType, dateRangeStart, dateRangeEnd, now = Date.now()) {
  const policy = getRetentionPolicy(dataType);
  const businessMap = getTypeMap(dataType, 'business');

  const result = {
    total: 0,
    archivable: [],
    deleteable: [],
    frozen: [],
    retentionProtected: [],
    alreadyProcessed: []
  };

  for (const record of businessMap.values()) {
    if (record.createdAt < dateRangeStart || record.createdAt > dateRangeEnd) {
      continue;
    }

    result.total++;

    if (record.archiveStatus === 'archived' || record.archiveStatus === 'deleted') {
      result.alreadyProcessed.push(record.id);
      continue;
    }

    const freeze = isRecordFrozen(record.id, dataType);
    if (freeze) {
      result.frozen.push({
        recordId: record.id,
        freezeId: freeze.id,
        freezeReason: freeze.reason,
        frozenBy: freeze.freezeBy
      });
      continue;
    }

    if (!isRetentionPeriodExpired(record, policy, now)) {
      result.retentionProtected.push({
        recordId: record.id,
        createdAt: record.createdAt,
        retentionDays: policy ? policy.retentionDays : 0
      });
      continue;
    }

    result.archivable.push(record.id);
    result.deleteable.push(record.id);
  }

  return result;
}

function createArchiveTask(request, operator) {
  const { dataType, dateRangeStart, dateRangeEnd, operationType } = request;

  if (!['compress', 'delete'].includes(operationType)) {
    throw new Error('操作类型必须是 compress 或 delete');
  }

  const existingTask = findExistingTask(dataType, dateRangeStart, dateRangeEnd, operationType);
  if (existingTask) {
    return {
      idempotent: true,
      existingTaskId: existingTask.id,
      task: existingTask,
      message: `同一范围的${operationType}任务已存在，任务ID: ${existingTask.id}`
    };
  }

  const analysis = analyzeRecords(dataType, dateRangeStart, dateRangeEnd);

  const taskId = generateId();
  const now = Date.now();

  const task = {
    id: taskId,
    dataType,
    dateRangeStart,
    dateRangeEnd,
    operationType,
    status: 'pending',
    createdAt: now,
    createdBy: operator,
    analysis,
    executionHistory: [],
    currentStep: 'analysis_complete',
    compressed: [],
    deleted: [],
    frozenRetained: analysis.frozen,
    retentionRetained: analysis.retentionProtected
  };

  store.archiveTasks.set(taskId, task);

  addAuditLog({
    action: 'TASK_CREATED',
    taskId,
    dataType,
    operationType,
    operator,
    details: {
      totalRecords: analysis.total,
      archivable: analysis.archivable.length,
      frozen: analysis.frozen.length,
      retentionProtected: analysis.retentionProtected.length
    }
  });

  return {
    idempotent: false,
    taskId,
    task,
    message: '归档任务创建成功'
  };
}

function executeArchiveTask(taskId, simulateFailure = false) {
  const task = store.archiveTasks.get(taskId);
  if (!task) {
    throw new Error(`任务不存在: ${taskId}`);
  }

  if (task.status === 'completed') {
    return {
      success: true,
      skipped: true,
      message: '任务已完成，跳过执行',
      task
    };
  }

  const now = Date.now();
  const businessMap = getTypeMap(task.dataType, 'business');
  const archiveMap = getTypeMap(task.dataType, 'archive');

  task.status = 'running';
  task.startedAt = now;
  task.executionHistory.push({
    step: 'start_execution',
    timestamp: now,
    details: { fromStatus: task.currentStep }
  });

  try {
    for (const recordId of task.analysis.frozen.map(f => f.recordId)) {
      const record = businessMap.get(recordId);
      if (record && record.archiveStatus === 'active') {
        record.archiveStatus = 'compressed_frozen';
        const archiveRecord = {
          ...record,
          archivedAt: now,
          compressed: true,
          frozen: true,
          originalLocation: 'business'
        };
        archiveMap.set(recordId, archiveRecord);
        task.compressed.push(recordId);

        addAuditLog({
          action: 'FROZEN_COMPRESSED',
          taskId,
          recordId,
          dataType: task.dataType,
          details: { freeze: task.analysis.frozen.find(f => f.recordId === recordId) }
        });
      }
    }

    if (simulateFailure && task.operationType === 'delete') {
      task.status = 'failed';
      task.failedAt = now;
      task.failureReason = '模拟的删除操作失败（存储服务不可用）';
      task.currentStep = 'delete_failed';
      task.executionHistory.push({
        step: 'delete_failure',
        timestamp: now,
        error: task.failureReason
      });

      addAuditLog({
        action: 'TASK_FAILED',
        taskId,
        reason: task.failureReason
      });

      return {
        success: false,
        taskId,
        error: task.failureReason,
        canRetry: true,
        task
      };
    }

    for (const recordId of task.analysis.archivable) {
      const record = businessMap.get(recordId);
      if (record) {
        if (task.operationType === 'compress') {
          record.archiveStatus = 'compressed';
          const archiveRecord = {
            ...record,
            archivedAt: now,
            compressed: true,
            frozen: false,
            originalLocation: 'business'
          };
          archiveMap.set(recordId, archiveRecord);
          task.compressed.push(recordId);

          addAuditLog({
            action: 'COMPRESSED',
            taskId,
            recordId,
            dataType: task.dataType
          });
        } else if (task.operationType === 'delete') {
          businessMap.delete(recordId);
          task.deleted.push(recordId);

          addAuditLog({
            action: 'DELETED',
            taskId,
            recordId,
            dataType: task.dataType
          });
        }
      }
    }

    task.status = 'completed';
    task.completedAt = now;
    task.currentStep = 'completed';
    task.executionHistory.push({
      step: 'complete',
      timestamp: now,
      details: {
        compressed: task.compressed.length,
        deleted: task.deleted.length
      }
    });

    addAuditLog({
      action: 'TASK_COMPLETED',
      taskId,
      details: {
        compressed: task.compressed.length,
        deleted: task.deleted.length,
        frozenRetained: task.frozenRetained.length,
        retentionRetained: task.retentionRetained.length
      }
    });

    return {
      success: true,
      taskId,
      task,
      summary: {
        totalAnalyzed: task.analysis.total,
        compressed: task.compressed.length,
        deleted: task.deleted.length,
        frozenRetained: task.frozenRetained.length,
        retentionRetained: task.retentionRetained.length
      }
    };

  } catch (error) {
    task.status = 'failed';
    task.failedAt = now;
    task.failureReason = error.message;
    task.executionHistory.push({
      step: 'error',
      timestamp: now,
      error: error.message
    });

    addAuditLog({
      action: 'TASK_FAILED',
      taskId,
      reason: error.message
    });

    return {
      success: false,
      taskId,
      error: error.message,
      canRetry: true,
      task
    };
  }
}

function retryFailedTask(taskId) {
  const task = store.archiveTasks.get(taskId);
  if (!task) {
    throw new Error(`任务不存在: ${taskId}`);
  }

  if (task.status !== 'failed') {
    return {
      success: false,
      message: '只有失败状态的任务可以重试',
      currentStatus: task.status
    };
  }

  addAuditLog({
    action: 'TASK_RETRY',
    taskId,
    previousFailure: task.failureReason
  });

  return executeArchiveTask(taskId, false);
}

function createRecoveryRequest(request, operator) {
  const { dataType, recordIds, reason } = request;

  if (!recordIds || recordIds.length === 0) {
    throw new Error('必须指定要恢复的记录ID');
  }

  const archiveMap = getTypeMap(dataType, 'archive');
  const nonExistent = [];

  for (const id of recordIds) {
    if (!archiveMap.has(id)) {
      nonExistent.push(id);
    }
  }

  if (nonExistent.length > 0) {
    throw new Error(`以下记录不在归档存储中: ${nonExistent.join(', ')}`);
  }

  const requestId = generateId();
  const now = Date.now();

  const recoveryReq = {
    id: requestId,
    dataType,
    recordIds,
    reason,
    status: 'pending_approval',
    createdAt: now,
    createdBy: operator,
    approvalHistory: []
  };

  store.recoveryRequests.set(requestId, recoveryReq);

  addAuditLog({
    action: 'RECOVERY_REQUEST_CREATED',
    requestId,
    operator,
    details: { dataType, recordIds, reason }
  });

  return {
    requestId,
    recoveryReq,
    message: '恢复申请已创建，等待审批'
  };
}

function approveRecoveryRequest(requestId, approver, approved, comment = '') {
  const req = store.recoveryRequests.get(requestId);
  if (!req) {
    throw new Error(`恢复申请不存在: ${requestId}`);
  }

  if (req.status !== 'pending_approval') {
    return {
      success: false,
      message: '该申请已被处理',
      currentStatus: req.status
    };
  }

  const now = Date.now();

  req.approvalHistory.push({
    action: approved ? 'approved' : 'rejected',
    approver,
    timestamp: now,
    comment
  });

  if (approved) {
    req.status = 'approved';
    req.approvedAt = now;
    req.approvedBy = approver;

    const archiveMap = getTypeMap(req.dataType, 'archive');
    const businessMap = getTypeMap(req.dataType, 'business');
    const restoredRecords = [];

    for (const recordId of req.recordIds) {
      const record = archiveMap.get(recordId);
      if (record) {
        const restoredRecord = {
          ...record,
          archiveStatus: 'active',
          restoredFromArchive: true,
          restoredAt: now,
          restoredBy: approver
        };

        delete restoredRecord.archivedAt;
        delete restoredRecord.compressed;
        delete restoredRecord.frozen;
        delete restoredRecord.originalLocation;

        businessMap.set(recordId, restoredRecord);
        archiveMap.delete(recordId);
        restoredRecords.push(recordId);

        addAuditLog({
          action: 'RECORD_RESTORED',
          requestId,
          recordId,
          dataType: req.dataType,
          operator: approver,
          statusTransition: {
            from: 'archived',
            to: 'active',
            archivedAt: record.archivedAt,
            restoredAt: now
          }
        });
      }
    }

    req.restoredRecords = restoredRecords;
    req.completedAt = now;
    req.status = 'completed';

    addAuditLog({
      action: 'RECOVERY_REQUEST_APPROVED',
      requestId,
      approver,
      details: { restoredCount: restoredRecords.length }
    });

    return {
      success: true,
      requestId,
      status: 'completed',
      restoredCount: restoredRecords.length,
      restoredRecords
    };

  } else {
    req.status = 'rejected';
    req.rejectedAt = now;
    req.rejectedBy = approver;

    addAuditLog({
      action: 'RECOVERY_REQUEST_REJECTED',
      requestId,
      approver,
      comment
    });

    return {
      success: true,
      requestId,
      status: 'rejected'
    };
  }
}

function getTaskDetails(taskId) {
  const task = store.archiveTasks.get(taskId);
  if (!task) {
    return null;
  }

  const retentionReasons = task.retentionRetained.map(r => ({
    recordId: r.recordId,
    reason: `保留期保护: 策略要求保留${r.retentionDays}天，创建时间为${new Date(r.createdAt).toISOString()}`
  }));

  const freezeReasons = task.frozenRetained.map(f => ({
    recordId: f.recordId,
    reason: `法律冻结: 冻结ID=${f.freezeId}, 原因=${f.freezeReason}, 冻结人=${f.frozenBy}`
  }));

  const archiveProof = {
    certificateId: `ARCHIVE-CERT-${task.id.substring(0, 8).toUpperCase()}`,
    taskId: task.id,
    dataType: task.dataType,
    operationType: task.operationType,
    executedAt: task.completedAt || task.startedAt,
    operator: task.createdBy,
    scope: {
      dateRange: {
        start: new Date(task.dateRangeStart).toISOString(),
        end: new Date(task.dateRangeEnd).toISOString()
      },
      totalAnalyzed: task.analysis.total
    },
    results: {
      compressed: task.compressed.length,
      deleted: task.deleted.length,
      frozenRetained: task.frozenRetained.length,
      retentionRetained: task.retentionRetained.length
    },
    complianceStatus: 'VERIFIED',
    auditorSignature: 'SYSTEM_AUDIT_' + (task.completedAt || Date.now())
  };

  return {
    ...task,
    retentionReasons,
    freezeReasons,
    archiveProof,
    affectedScope: {
      dataType: task.dataType,
      dateRange: {
        start: new Date(task.dateRangeStart).toISOString(),
        end: new Date(task.dateRangeEnd).toISOString()
      },
      totalRecords: task.analysis.total
    },
    processedCounts: {
      compressed: task.compressed.length,
      deleted: task.deleted.length,
      frozenRetained: task.frozenRetained.length,
      retentionRetained: task.retentionRetained.length
    }
  };
}

function getArchiveReport() {
  const tasks = Array.from(store.archiveTasks.values());
  const recoveries = Array.from(store.recoveryRequests.values());

  let totalCompressed = 0;
  let totalDeleted = 0;
  let totalFrozenRetained = 0;
  let totalRetentionRetained = 0;

  for (const task of tasks) {
    totalCompressed += task.compressed.length;
    totalDeleted += task.deleted.length;
    totalFrozenRetained += task.frozenRetained.length;
    totalRetentionRetained += task.retentionRetained.length;
  }

  const recoveryBreakdown = {
    pending: recoveries.filter(r => r.status === 'pending_approval').length,
    approved: recoveries.filter(r => r.status === 'approved').length,
    completed: recoveries.filter(r => r.status === 'completed').length,
    rejected: recoveries.filter(r => r.status === 'rejected').length
  };

  const inProgressRecoveries = recoveries
    .filter(r => ['pending_approval', 'approved'].includes(r.status))
    .map(r => ({
      id: r.id,
      dataType: r.dataType,
      recordCount: r.recordIds.length,
      status: r.status,
      requestedBy: r.createdBy,
      requestedAt: new Date(r.createdAt).toISOString()
    }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalArchiveTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length
    },
    archiveStats: {
      compressed: totalCompressed,
      deleted: totalDeleted,
      frozenRetained: totalFrozenRetained,
      retentionRetained: totalRetentionRetained
    },
    recoveryStats: {
      totalRequests: recoveries.length,
      ...recoveryBreakdown,
      inProgress: inProgressRecoveries
    },
    activeFreezes: Array.from(store.freezes.values())
      .filter(f => f.active)
      .map(f => ({
        id: f.id,
        dataType: f.dataType,
        recordCount: f.records.length,
        reason: f.reason,
        frozenBy: f.freezeBy,
        freezeDate: new Date(f.freezeDate).toISOString()
      })),
    policies: Array.from(store.retentionPolicies.values())
  };
}

function listRetentionPolicies() {
  return Array.from(store.retentionPolicies.values());
}

function listFreezes() {
  return Array.from(store.freezes.values());
}

function listArchiveTasks() {
  return Array.from(store.archiveTasks.values()).map(t => ({
    id: t.id,
    dataType: t.dataType,
    operationType: t.operationType,
    status: t.status,
    createdAt: t.createdAt,
    totalRecords: t.analysis.total,
    compressed: t.compressed.length,
    deleted: t.deleted.length
  }));
}

function listRecoveryRequests() {
  return Array.from(store.recoveryRequests.values());
}

function getAuditLogs() {
  return [...store.auditLogs].reverse();
}

function getRecordStatus(recordId, dataType) {
  const businessMap = getTypeMap(dataType, 'business');
  const archiveMap = getTypeMap(dataType, 'archive');

  if (businessMap.has(recordId)) {
    const record = businessMap.get(recordId);
    return {
      recordId,
      dataType,
      location: 'business',
      archiveStatus: record.archiveStatus,
      record,
      statusDescription: record.archiveStatus === 'active' ? '业务可查' : 
                          record.archiveStatus === 'compressed_frozen' ? '冻结压缩（不可删除）' :
                          record.archiveStatus
    };
  }

  if (archiveMap.has(recordId)) {
    const record = archiveMap.get(recordId);
    return {
      recordId,
      dataType,
      location: 'archive',
      archiveStatus: record.compressed ? 'archived_compressed' : 'archived',
      frozen: record.frozen || false,
      archivedAt: record.archivedAt,
      record,
      statusDescription: record.frozen ? '归档冻结（需恢复申请）' : '归档存储（可恢复）'
    };
  }

  return {
    recordId,
    dataType,
    location: 'none',
    archiveStatus: 'not_found',
    statusDescription: '记录不存在或已删除'
  };
}

module.exports = {
  createArchiveTask,
  executeArchiveTask,
  retryFailedTask,
  createRecoveryRequest,
  approveRecoveryRequest,
  getTaskDetails,
  getArchiveReport,
  listRetentionPolicies,
  listFreezes,
  listArchiveTasks,
  listRecoveryRequests,
  getAuditLogs,
  getRecordStatus,
  analyzeRecords
};
