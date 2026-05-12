const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../data/db');
const { createVisitorApplication, VISITOR_STATUS, EVENT_TYPES, EXCEPTION_TYPES } = require('../models/visitor');
const { validateTransition, checkBusinessRules, applyEvent } = require('../services/stateMachine');

const router = express.Router();

router.use(express.json());

function handleIdempotency(req, res, key, callback) {
  const existing = db.getVisitorByIdempotencyKey(key);
  if (existing) {
    return res.status(200).json({
      success: true,
      idempotent: true,
      message: '幂等命中 - 该请求已处理',
      data: existing
    });
  }
  return callback();
}

router.post('/applications', (req, res) => {
  try {
    const data = req.body;
    const idempotencyKey = data.idempotencyKey || req.headers['x-idempotency-key'];
    
    if (!data.name || !data.idCard) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '访客姓名和身份证号为必填项'
      });
    }
    
    if (idempotencyKey) {
      return handleIdempotency(req, res, idempotencyKey, () => {
        const visitor = createVisitorApplication({ ...data, idempotencyKey });
        db.saveVisitor(visitor);
        res.status(201).json({
          success: true,
          message: '访客申请创建成功',
          data: {
            visitorId: visitor.id,
            status: visitor.status,
            idempotencyKey: visitor.idempotencyKey
          }
        });
      });
    }
    
    const visitor = createVisitorApplication(data);
    db.saveVisitor(visitor);
    
    res.status(201).json({
      success: true,
      message: '访客申请创建成功',
      data: {
        visitorId: visitor.id,
        status: visitor.status,
        idempotencyKey: visitor.idempotencyKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/applications/:visitorId', (req, res) => {
  const visitor = db.getVisitor(req.params.visitorId);
  if (!visitor) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: '访客记录不存在'
    });
  }
  
  res.json({
    success: true,
    data: {
      visitor: {
        id: visitor.id,
        name: visitor.name,
        company: visitor.company,
        idCard: visitor.idCard,
        purpose: visitor.purpose,
        status: visitor.status,
        approvalStatus: visitor.approvalStatus,
        companionConfirmed: visitor.companionConfirmed,
        companionName: visitor.companionName,
        devices: visitor.devices,
        expectedEntryTime: visitor.expectedEntryTime,
        expectedExitTime: visitor.expectedExitTime,
        actualEntryTime: visitor.actualEntryTime,
        actualExitTime: visitor.actualExitTime,
        exceptions: visitor.exceptions,
        history: visitor.history,
        createdAt: visitor.createdAt,
        updatedAt: visitor.updatedAt
      }
    }
  });
});

router.get('/applications', (req, res) => {
  const { status, idCard, name, companionId, hasExceptions } = req.query;
  const visitors = db.getAllVisitors({
    status,
    idCard,
    name,
    companionId,
    hasExceptions: hasExceptions === 'true'
  });
  
  res.json({
    success: true,
    data: {
      total: visitors.length,
      visitors: visitors.map(v => ({
        id: v.id,
        name: v.name,
        company: v.company,
        status: v.status,
        companionName: v.companionName,
        exceptionCount: (v.exceptions || []).length,
        createdAt: v.createdAt
      }))
    }
  });
});

router.post('/applications/:visitorId/approve', (req, res) => {
  processEvent(req, res, EVENT_TYPES.APPROVE);
});

router.post('/applications/:visitorId/reject', (req, res) => {
  processEvent(req, res, EVENT_TYPES.REJECT);
});

router.post('/applications/:visitorId/confirm-companion', (req, res) => {
  processEvent(req, res, EVENT_TYPES.CONFIRM_COMPANION);
});

router.post('/applications/:visitorId/check-in', (req, res) => {
  processEvent(req, res, EVENT_TYPES.CHECK_IN);
});

router.post('/applications/:visitorId/check-out', (req, res) => {
  processEvent(req, res, EVENT_TYPES.CHECK_OUT);
});

router.post('/applications/:visitorId/timeout', (req, res) => {
  processEvent(req, res, EVENT_TYPES.TIMEOUT);
});

router.post('/applications/:visitorId/exceptions', (req, res) => {
  processEvent(req, res, EVENT_TYPES.EXCEPTION_REPORT);
});

router.post('/applications/:visitorId/correct', (req, res) => {
  processEvent(req, res, EVENT_TYPES.MANUAL_CORRECTION);
});

function processEvent(req, res, eventType) {
  const visitor = db.getVisitor(req.params.visitorId);
  if (!visitor) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: '访客记录不存在'
    });
  }
  
  const idempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'];
  if (idempotencyKey) {
    const existingEvent = visitor.history.find(h => h.idempotencyKey === idempotencyKey);
    if (existingEvent) {
      return res.status(200).json({
        success: true,
        idempotent: true,
        message: '幂等命中 - 该事件已处理',
        data: {
          visitorId: visitor.id,
          status: visitor.status,
          previousStatus: existingEvent.previousStatus,
          event: existingEvent
        }
      });
    }
  }
  
  const transitionCheck = validateTransition(visitor, eventType);
  if (!transitionCheck.valid) {
    return res.status(400).json({
      success: false,
      error: 'STATE_TRANSITION_ERROR',
      message: transitionCheck.reason,
      data: {
        currentStatus: visitor.status,
        attemptedEvent: eventType
      }
    });
  }
  
  const businessErrors = checkBusinessRules(visitor, eventType, req.body, db);
  if (businessErrors.length > 0 && !req.body.force) {
    return res.status(400).json({
      success: false,
      error: 'BUSINESS_RULE_VIOLATION',
      message: businessErrors[0].message,
      data: {
        currentStatus: visitor.status,
        errors: businessErrors
      }
    });
  }
  
  const result = applyEvent(visitor, eventType, req.body, req.body.operatorId);
  db.saveVisitor(visitor);
  
  res.json({
    success: true,
    message: getEventSuccessMessage(eventType),
    data: {
      visitorId: visitor.id,
      previousStatus: result.historyEntry.previousStatus,
      newStatus: visitor.status,
      diff: result.historyEntry.diff || {},
      exceptions: visitor.exceptions
    }
  });
}

function getEventSuccessMessage(eventType) {
  const messages = {
    [EVENT_TYPES.APPROVE]: '审批通过',
    [EVENT_TYPES.REJECT]: '审批拒绝',
    [EVENT_TYPES.CONFIRM_COMPANION]: '陪同人确认',
    [EVENT_TYPES.CHECK_IN]: '入场核销成功',
    [EVENT_TYPES.CHECK_OUT]: '离场核销成功',
    [EVENT_TYPES.TIMEOUT]: '超时告警已记录',
    [EVENT_TYPES.EXCEPTION_REPORT]: '异常已上报',
    [EVENT_TYPES.MANUAL_CORRECTION]: '人工修正已应用'
  };
  return messages[eventType] || '操作成功';
}

router.get('/applications/:visitorId/history', (req, res) => {
  const visitor = db.getVisitor(req.params.visitorId);
  if (!visitor) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: '访客记录不存在'
    });
  }
  
  res.json({
    success: true,
    data: {
      visitorId: visitor.id,
      history: visitor.history.map(h => ({
        id: h.id,
        eventType: h.eventType,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        operatorId: h.operatorId,
        timestamp: h.timestamp,
        notes: h.notes,
        diff: h.diff || {},
        eventData: h.eventData
      }))
    }
  });
});

router.get('/timeline/:visitorId', (req, res) => {
  const visitor = db.getVisitor(req.params.visitorId);
  if (!visitor) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: '访客记录不存在'
    });
  }
  
  const timeline = buildTimeline(visitor);
  
  res.json({
    success: true,
    data: {
      visitorId: visitor.id,
      visitorName: visitor.name,
      timeline
    }
  });
});

function buildTimeline(visitor) {
  const events = [];
  
  events.push({
    time: visitor.createdAt,
    type: 'APPLICATION',
    title: '访客申请',
    description: `${visitor.name} 提交机房访问申请，目的: ${visitor.purpose}`,
    status: 'APPLIED'
  });
  
  if (visitor.approvedAt) {
    events.push({
      time: visitor.approvedAt,
      type: 'APPROVAL',
      title: visitor.approvalStatus === 'APPROVED' ? '审批通过' : '审批拒绝',
      description: `审批人: ${visitor.approverName || visitor.approverId}, 备注: ${visitor.approvalNote || '无'}`,
      status: visitor.approvalStatus
    });
  }
  
  if (visitor.companionConfirmedAt) {
    events.push({
      time: visitor.companionConfirmedAt,
      type: 'COMPANION',
      title: '陪同人确认',
      description: `陪同人: ${visitor.companionName || visitor.companionId}`,
      status: 'CONFIRMED'
    });
  }
  
  if (visitor.actualEntryTime) {
    events.push({
      time: visitor.actualEntryTime,
      type: 'CHECK_IN',
      title: '入场核销',
      description: `携带设备: ${visitor.devices.filter(d => d.checkedIn).length} 台`,
      status: 'CHECKED_IN'
    });
  }
  
  if (visitor.actualExitTime) {
    events.push({
      time: visitor.actualExitTime,
      type: 'CHECK_OUT',
      title: '离场核销',
      description: `带出设备: ${visitor.devices.filter(d => d.checkedOut).length} 台`,
      status: 'CHECKED_OUT'
    });
  }
  
  (visitor.exceptions || []).forEach(ex => {
    events.push({
      time: ex.reportedAt,
      type: 'EXCEPTION',
      title: `异常告警: ${ex.type}`,
      description: ex.message,
      status: 'EXCEPTION',
      severity: 'HIGH'
    });
  });
  
  return events.sort((a, b) => a.time - b.time);
}

router.get('/reports/audit', (req, res) => {
  const { format = 'json', startDate, endDate } = req.query;
  
  const allVisitors = db.getAllVisitors();
  const now = Date.now();
  
  const stats = {
    totalApplications: allVisitors.length,
    byStatus: {},
    byExceptionType: {},
    activeVisitors: 0,
    devicesLeftBehind: 0,
    timeoutCount: 0,
    approvalRate: 0
  };
  
  const companionRecords = [];
  const deviceInventory = [];
  
  allVisitors.forEach(v => {
    stats.byStatus[v.status] = (stats.byStatus[v.status] || 0) + 1;
    
    if (v.status === VISITOR_STATUS.CHECKED_IN) stats.activeVisitors++;
    if (v.status === VISITOR_STATUS.TIMEOUT) stats.timeoutCount++;
    
    (v.exceptions || []).forEach(ex => {
      stats.byExceptionType[ex.type] = (stats.byExceptionType[ex.type] || 0) + 1;
      if (ex.type === EXCEPTION_TYPES.DEVICE_NOT_CHECKED_OUT) stats.devicesLeftBehind++;
    });
    
    if (v.companionConfirmed) {
      companionRecords.push({
        visitorId: v.id,
        visitorName: v.name,
        companionId: v.companionId,
        companionName: v.companionName,
        entryTime: v.actualEntryTime,
        exitTime: v.actualExitTime,
        status: v.status
      });
    }
    
    v.devices.forEach(d => {
      deviceInventory.push({
        visitorId: v.id,
        visitorName: v.name,
        deviceId: d.id,
        type: d.type,
        serialNumber: d.serialNumber,
        checkedIn: d.checkedIn,
        checkedOut: d.checkedOut,
        leftBehind: d.checkedIn && !d.checkedOut
      });
    });
  });
  
  const approved = allVisitors.filter(v => v.approvalStatus === 'APPROVED').length;
  const reviewed = allVisitors.filter(v => v.approvalStatus).length;
  stats.approvalRate = reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0;
  
  const report = {
    reportId: uuidv4(),
    generatedAt: now,
    period: {
      start: startDate ? new Date(startDate).getTime() : null,
      end: endDate ? new Date(endDate).getTime() : now
    },
    summary: stats,
    companionRecords,
    deviceInventory,
    exceptions: allVisitors
      .filter(v => (v.exceptions || []).length > 0)
      .map(v => ({
        visitorId: v.id,
        visitorName: v.name,
        status: v.status,
        exceptions: v.exceptions
      }))
  };
  
  if (format === 'json') {
    res.json({
      success: true,
      data: report
    });
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-report-${Date.now()}.json`);
    res.send(JSON.stringify(report, null, 2));
  }
});

router.get('/companions', (req, res) => {
  res.json({
    success: true,
    data: db.getAllCompanions()
  });
});

router.get('/approvers', (req, res) => {
  res.json({
    success: true,
    data: db.getAllApprovers()
  });
});

router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      statusDefinitions: VISITOR_STATUS,
      eventTypes: EVENT_TYPES,
      exceptionTypes: EXCEPTION_TYPES
    }
  });
});

module.exports = router;
