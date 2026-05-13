const StorageService = require('./storage');
const { BlockingItem, RetirementReport } = require('../models');

const RECENT_CALL_DAYS = 30;

function isRecentCall(callTime) {
  const callDate = new Date(callTime);
  const now = new Date();
  const diffDays = (now - callDate) / (1000 * 60 * 60 * 24);
  return diffDays <= RECENT_CALL_DAYS;
}

function isApplicationExpired(application) {
  const now = new Date();
  const expiryDate = new Date(application.expiresAt);
  return now > expiryDate;
}

function checkRecentCalls(applicationId) {
  const callLogs = StorageService.getCallLogsByApplicationId(applicationId);
  const recentCalls = callLogs.filter(log => isRecentCall(log.callTime));
  
  if (recentCalls.length === 0) {
    return { blocked: false, items: [] };
  }

  const callers = {};
  let lastCallTime = null;

  for (const call of recentCalls) {
    if (!callers[call.callerService]) {
      callers[call.callerService] = {
        callerService: call.callerService,
        endpoints: [],
        totalCount: 0
      };
    }
    callers[call.callerService].endpoints.push({
      endpoint: call.calledEndpoint,
      lastCallTime: call.callTime,
      count: call.requestCount,
      successRate: call.successRate
    });
    callers[call.callerService].totalCount += call.requestCount;

    if (!lastCallTime || new Date(call.callTime) > new Date(lastCallTime)) {
      lastCallTime = call.callTime;
    }
  }

  const blockItem = new BlockingItem(
    'RECENT_CALLS',
    `服务在最近${RECENT_CALL_DAYS}天内仍有${recentCalls.length}次调用`,
    {
      recentCallDays: RECENT_CALL_DAYS,
      callCount: recentCalls.length,
      callers: Object.values(callers),
      lastCallTime: lastCallTime
    }
  );

  return { blocked: true, items: [blockItem] };
}

function checkCriticalTasks(applicationId) {
  const tasks = StorageService.getTasksByApplicationId(applicationId);
  const unresolvedCriticalTasks = tasks.filter(
    task => task.isCritical && task.migrationStatus !== 'COMPLETED'
  );

  if (unresolvedCriticalTasks.length === 0) {
    return { blocked: false, items: [] };
  }

  const blockItem = new BlockingItem(
    'CRITICAL_TASKS_NOT_MIGRATED',
    `有${unresolvedCriticalTasks.length}个关键任务未完成迁移`,
    {
      tasks: unresolvedCriticalTasks.map(task => ({
        taskId: task.id,
        taskName: task.taskName,
        taskType: task.taskType,
        migrationStatus: task.migrationStatus,
        responsiblePerson: task.responsiblePerson
      }))
    }
  );

  return { blocked: true, items: [blockItem] };
}

function checkConfirmations(applicationId) {
  const confirmations = StorageService.getConfirmationsByApplicationId(applicationId);
  
  if (confirmations.length === 0) {
    const blockItem = new BlockingItem(
      'NO_CONFIRMATIONS',
      '没有配置负责人确认流程',
      {}
    );
    return { blocked: true, items: [blockItem] };
  }

  const unconfirmed = confirmations.filter(conf => !conf.confirmed);

  if (unconfirmed.length === 0) {
    return { blocked: false, items: [] };
  }

  const blockItem = new BlockingItem(
    'CONFIRMATIONS_PENDING',
    `有${unconfirmed.length}个负责人确认待处理`,
    {
      pendingConfirmations: unconfirmed.map(conf => ({
        confirmationId: conf.id,
        personName: conf.personName,
        personEmail: conf.personEmail,
        role: conf.role
      }))
    }
  );

  return { blocked: true, items: [blockItem] };
}

function checkAlerts(applicationId) {
  const alerts = StorageService.getAlertsByApplicationId(applicationId);
  const activeAlerts = alerts.filter(alert => alert.status === 'ACTIVE');

  if (activeAlerts.length === 0) {
    return { blocked: false, items: [] };
  }

  const blockItem = new BlockingItem(
    'ACTIVE_ALERTS',
    `有${activeAlerts.length}个活跃告警未关闭`,
    {
      alerts: activeAlerts.map(alert => ({
        alertId: alert.id,
        alertName: alert.alertName,
        severity: alert.severity,
        responsiblePerson: alert.responsiblePerson
      }))
    }
  );

  return { blocked: true, items: [blockItem] };
}

function checkApplicationExpiry(application) {
  if (!isApplicationExpired(application)) {
    return { blocked: false, items: [] };
  }

  const blockItem = new BlockingItem(
    'APPLICATION_EXPIRED',
    '退役申请已过期，需要重新评估并延长有效期',
    {
      expiresAt: application.expiresAt,
      expiredDays: Math.floor((new Date() - new Date(application.expiresAt)) / (1000 * 60 * 60 * 24))
    }
  );

  return { blocked: true, items: [blockItem] };
}

function calculateRetirementWindow(blockingItems, application) {
  if (blockingItems.length === 0) {
    const plannedDate = application.planedRetirementDate 
      ? new Date(application.planedRetirementDate)
      : new Date();
    plannedDate.setDate(plannedDate.getDate() + 7);
    
    const windowEnd = new Date(plannedDate);
    windowEnd.setDate(windowEnd.getDate() + 14);
    
    return {
      status: 'READY',
      suggestedWindow: {
        start: plannedDate.toISOString(),
        end: windowEnd.toISOString()
      },
      recommendedAction: '服务已满足退役条件，可以在建议窗口内执行退役'
    };
  }

  const recentCallItem = blockingItems.find(item => item.type === 'RECENT_CALLS');
  if (recentCallItem) {
    const lastCallTime = new Date(recentCallItem.details.lastCallTime);
    const safeDate = new Date(lastCallTime);
    safeDate.setDate(safeDate.getDate() + RECENT_CALL_DAYS + 7);
    
    return {
      status: 'BLOCKED',
      suggestedWindow: {
        earliestPossible: safeDate.toISOString(),
        note: '需等待调用冷却期结束'
      },
      recommendedAction: '请协调调用方进行迁移，或确认是否为误报'
    };
  }

  const taskItem = blockingItems.find(item => item.type === 'CRITICAL_TASKS_NOT_MIGRATED');
  if (taskItem) {
    return {
      status: 'BLOCKED',
      suggestedWindow: null,
      recommendedAction: '请先完成所有关键任务的迁移工作'
    };
  }

  const expiryItem = blockingItems.find(item => item.type === 'APPLICATION_EXPIRED');
  if (expiryItem) {
    return {
      status: 'BLOCKED',
      suggestedWindow: null,
      recommendedAction: '请重新评估退役计划并更新申请有效期'
    };
  }

  return {
    status: 'BLOCKED',
    suggestedWindow: null,
    recommendedAction: '请处理所有阻断项后重试'
  };
}

function getLastCallTime(applicationId) {
  const callLogs = StorageService.getCallLogsByApplicationId(applicationId);
  if (callLogs.length === 0) return null;
  
  return callLogs.reduce((latest, log) => {
    return new Date(log.callTime) > new Date(latest) ? log.callTime : latest;
  }, callLogs[0].callTime);
}

function getCallersSummary(applicationId) {
  const callLogs = StorageService.getCallLogsByApplicationId(applicationId);
  const callers = {};

  for (const log of callLogs) {
    if (!callers[log.callerService]) {
      callers[log.callerService] = {
        callerService: log.callerService,
        lastCallTime: log.callTime,
        totalCalls: 0,
        endpoints: []
      };
    }
    
    if (new Date(log.callTime) > new Date(callers[log.callerService].lastCallTime)) {
      callers[log.callerService].lastCallTime = log.callTime;
    }
    
    callers[log.callerService].totalCalls += log.requestCount;
    
    const existingEndpoint = callers[log.callerService].endpoints.find(
      e => e.endpoint === log.calledEndpoint
    );
    if (existingEndpoint) {
      existingEndpoint.callCount += log.requestCount;
      if (new Date(log.callTime) > new Date(existingEndpoint.lastCallTime)) {
        existingEndpoint.lastCallTime = log.callTime;
      }
    } else {
      callers[log.callerService].endpoints.push({
        endpoint: log.calledEndpoint,
        callCount: log.requestCount,
        lastCallTime: log.callTime
      });
    }
  }

  return Object.values(callers);
}

function generateBlockingItems(application) {
  const allItems = [];
  
  const recentCallResult = checkRecentCalls(application.id);
  allItems.push(...recentCallResult.items);
  
  const taskResult = checkCriticalTasks(application.id);
  allItems.push(...taskResult.items);
  
  const confirmationResult = checkConfirmations(application.id);
  allItems.push(...confirmationResult.items);
  
  const alertResult = checkAlerts(application.id);
  allItems.push(...alertResult.items);
  
  const expiryResult = checkApplicationExpiry(application);
  allItems.push(...expiryResult.items);

  return allItems;
}

function getConfirmationStatus(applicationId) {
  const confirmations = StorageService.getConfirmationsByApplicationId(applicationId);
  
  return {
    total: confirmations.length,
    confirmed: confirmations.filter(c => c.confirmed).length,
    pending: confirmations.filter(c => !c.confirmed).length,
    details: confirmations.map(c => ({
      id: c.id,
      personName: c.personName,
      personEmail: c.personEmail,
      role: c.role,
      confirmed: c.confirmed,
      confirmedAt: c.confirmedAt
    }))
  };
}

function generateRetirementReport(application) {
  const report = new RetirementReport(application.id);
  
  report.blockingItems = generateBlockingItems(application);
  report.confirmationStatus = getConfirmationStatus(application.id);
  report.lastCallTime = getLastCallTime(application.id);
  report.callers = getCallersSummary(application.id);
  report.retirementWindow = calculateRetirementWindow(report.blockingItems, application);
  
  const blockingCount = report.blockingItems.length;
  if (blockingCount === 0) {
    report.summary = `服务 ${application.serviceName} 已满足所有退役条件，可以在建议窗口内执行退役操作。`;
  } else {
    report.summary = `服务 ${application.serviceName} 存在 ${blockingCount} 个阻断项，需要先处理这些问题才能进行退役。`;
  }
  
  StorageService.saveReport(report);
  
  return report;
}

function generateArchivedReport(application, closedAt) {
  const report = new RetirementReport(application.id);
  report.blockingItems = [];
  report.confirmationStatus = getConfirmationStatus(application.id);
  report.lastCallTime = getLastCallTime(application.id);
  report.callers = getCallersSummary(application.id);
  report.retirementWindow = {
    status: 'COMPLETED',
    actualRetirementDate: closedAt
  };
  report.isArchived = true;
  report.summary = `服务 ${application.serviceName} 已于 ${closedAt} 正式退役，此为归档报告。`;
  
  StorageService.saveReport(report);
  
  return report;
}

function canCloseApplication(application) {
  if (application.status === 'CLOSED') {
    return { canClose: false, reason: '申请已关闭' };
  }
  
  const blockingItems = generateBlockingItems(application);
  if (blockingItems.length > 0) {
    return {
      canClose: false,
      reason: `仍有 ${blockingItems.length} 个阻断项未处理`,
      blockingItems: blockingItems
    };
  }
  
  return { canClose: true };
}

module.exports = {
  isRecentCall,
  isApplicationExpired,
  checkRecentCalls,
  checkCriticalTasks,
  checkConfirmations,
  checkAlerts,
  checkApplicationExpiry,
  generateBlockingItems,
  calculateRetirementWindow,
  getLastCallTime,
  getCallersSummary,
  getConfirmationStatus,
  generateRetirementReport,
  generateArchivedReport,
  canCloseApplication
};
