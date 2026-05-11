const models = require('../models');
const dayjs = require('dayjs');
const weatherService = require('./weather');
const schedulingService = require('./scheduling');
const equipmentService = require('./equipment');

const { 
  flightRequests, 
  approvalLogs, 
  safetyReports, 
  weatherData,
  coaches,
  students,
  equipment,
  createId,
  FLIGHT_STATUS 
} = models;

const STATUS_FLOW = [
  FLIGHT_STATUS.DRAFT,
  FLIGHT_STATUS.WEATHER_CHECK,
  FLIGHT_STATUS.SCHEDULE_CHECK,
  FLIGHT_STATUS.EQUIPMENT_CHECK,
  FLIGHT_STATUS.PENDING_APPROVAL,
  FLIGHT_STATUS.APPROVED,
  FLIGHT_STATUS.IN_PROGRESS,
  FLIGHT_STATUS.COMPLETED
];

function canTransitionTo(currentStatus, targetStatus) {
  if (targetStatus === FLIGHT_STATUS.CANCELLED || targetStatus === FLIGHT_STATUS.REJECTED || targetStatus === FLIGHT_STATUS.NEEDS_REVIEW) {
    return true;
  }
  
  if (targetStatus === FLIGHT_STATUS.NEEDS_REVIEW) {
    return true;
  }

  const currentIndex = STATUS_FLOW.indexOf(currentStatus);
  const targetIndex = STATUS_FLOW.indexOf(targetStatus);
  
  if (currentIndex === -1 || targetIndex === -1) return false;
  
  return targetIndex === currentIndex + 1;
}

function validateRequestFields(data) {
  const required = ['studentId', 'date', 'timeSlot'];
  const missing = required.filter(f => !data[f]);
  
  if (missing.length > 0) {
    return {
      success: false,
      error: '缺少必填字段',
      missingFields: missing
    };
  }

  if (!students.find(s => s.id === data.studentId)) {
    return {
      success: false,
      error: '学员不存在'
    };
  }

  if (!['morning', 'afternoon'].includes(data.timeSlot)) {
    return {
      success: false,
      error: '时段无效，应为 morning 或 afternoon'
    };
  }

  return { success: true };
}

function createFlightRequest(data) {
  const validation = validateRequestFields(data);
  if (!validation.success) {
    return validation;
  }

  const student = students.find(s => s.id === data.studentId);
  
  const existing = flightRequests.find(fr =>
    fr.studentId === data.studentId &&
    fr.date === data.date &&
    fr.timeSlot === data.timeSlot &&
    !['cancelled', 'rejected', 'completed'].includes(fr.status)
  );

  if (existing) {
    return {
      success: false,
      error: '重复提交：该学员在此时段已有飞行申请',
      existingRequestId: existing.id,
      needsReview: false
    };
  }

  const request = {
    id: createId(),
    studentId: data.studentId,
    studentName: student.name,
    studentLevel: student.level,
    coachId: data.coachId || null,
    coachName: data.coachId ? coaches.find(c => c.id === data.coachId)?.name : null,
    weatherId: data.weatherId || null,
    equipmentIds: data.equipmentIds || [],
    date: data.date,
    timeSlot: data.timeSlot,
    status: FLIGHT_STATUS.DRAFT,
    checkResults: {},
    notes: data.notes || '',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    history: [
      {
        status: FLIGHT_STATUS.DRAFT,
        timestamp: dayjs().toISOString(),
        note: '创建申请'
      }
    ]
  };

  flightRequests.push(request);

  return {
    success: true,
    data: request,
    nextStep: '进行天气窗口检查'
  };
}

function checkWeatherWindow(requestId, weatherId) {
  const request = flightRequests.find(fr => fr.id === requestId);
  if (!request) {
    return { success: false, error: '飞行申请不存在' };
  }

  if (!canTransitionTo(request.status, FLIGHT_STATUS.WEATHER_CHECK)) {
    return {
      success: false,
      error: '非法状态流转',
      currentStatus: request.status,
      expectedPrevious: STATUS_FLOW[STATUS_FLOW.indexOf(FLIGHT_STATUS.WEATHER_CHECK) - 1]
    };
  }

  const weather = weatherData.find(w => w.id === weatherId);
  if (!weather) {
    return {
      success: false,
      error: '天气窗口不存在',
      needsReview: false
    };
  }

  if (weather.date !== request.date || weather.timeSlot !== request.timeSlot) {
    return {
      success: false,
      error: '天气窗口与申请时段不匹配',
      needsReview: true
    };
  }

  const result = weatherService.checkWeatherCompatibility(weatherId, request.studentLevel);
  
  request.weatherId = weatherId;
  request.checkResults.weather = {
    ...result,
    checkedAt: dayjs().toISOString()
  };
  request.updatedAt = dayjs().toISOString();

  if (result.success) {
    request.status = FLIGHT_STATUS.WEATHER_CHECK;
    request.history.push({
      status: FLIGHT_STATUS.WEATHER_CHECK,
      timestamp: dayjs().toISOString(),
      note: '天气窗口检查通过'
    });
  } else {
    request.status = FLIGHT_STATUS.NEEDS_REVIEW;
    request.history.push({
      status: FLIGHT_STATUS.NEEDS_REVIEW,
      timestamp: dayjs().toISOString(),
      note: `天气窗口检查失败: ${result.error}`
    });
  }

  return {
    success: result.success,
    data: request,
    result,
    needsReview: result.needsReview || !result.success,
    nextStep: result.success ? '进行教练排班检查' : '需要人工复核'
  };
}

function checkCoachSchedule(requestId, coachId) {
  const request = flightRequests.find(fr => fr.id === requestId);
  if (!request) {
    return { success: false, error: '飞行申请不存在' };
  }

  if (!canTransitionTo(request.status, FLIGHT_STATUS.SCHEDULE_CHECK)) {
    return {
      success: false,
      error: '非法状态流转',
      currentStatus: request.status,
      expectedPrevious: STATUS_FLOW[STATUS_FLOW.indexOf(FLIGHT_STATUS.SCHEDULE_CHECK) - 1],
      needsReview: true
    };
  }

  const coach = coaches.find(c => c.id === coachId);
  if (!coach) {
    return {
      success: false,
      error: '教练不存在',
      needsReview: false
    };
  }

  const availability = schedulingService.checkCoachAvailability(coachId, request.date, request.timeSlot);
  const levelMatch = schedulingService.checkLevelCompatibility(coachId, request.studentId);
  const studentCheck = schedulingService.checkStudentRequirements(request.studentId);

  const allSuccess = availability.success && levelMatch.success && studentCheck.success;
  
  request.coachId = coachId;
  request.coachName = coach.name;
  request.checkResults.scheduling = {
    availability,
    levelMatch,
    studentCheck,
    checkedAt: dayjs().toISOString()
  };
  request.updatedAt = dayjs().toISOString();

  if (allSuccess) {
    request.status = FLIGHT_STATUS.SCHEDULE_CHECK;
    request.history.push({
      status: FLIGHT_STATUS.SCHEDULE_CHECK,
      timestamp: dayjs().toISOString(),
      note: '教练排班检查通过'
    });
  } else {
    request.status = FLIGHT_STATUS.NEEDS_REVIEW;
    request.history.push({
      status: FLIGHT_STATUS.NEEDS_REVIEW,
      timestamp: dayjs().toISOString(),
      note: '教练排班检查异常，需要复核'
    });
  }

  return {
    success: allSuccess,
    data: request,
    results: { availability, levelMatch, studentCheck },
    needsReview: availability.needsReview || levelMatch.needsReview || studentCheck.needsReview || !allSuccess,
    nextStep: allSuccess ? '进行装备检查' : '需要人工复核'
  };
}

function checkEquipmentSelection(requestId, equipmentIds) {
  const request = flightRequests.find(fr => fr.id === requestId);
  if (!request) {
    return { success: false, error: '飞行申请不存在' };
  }

  if (!canTransitionTo(request.status, FLIGHT_STATUS.EQUIPMENT_CHECK)) {
    return {
      success: false,
      error: '非法状态流转',
      currentStatus: request.status,
      expectedPrevious: STATUS_FLOW[STATUS_FLOW.indexOf(FLIGHT_STATUS.EQUIPMENT_CHECK) - 1],
      needsReview: true
    };
  }

  const weather = weatherData.find(w => w.id === request.weatherId);
  const windSpeed = weather?.windSpeed || 15;

  const result = equipmentService.checkEquipment(
    equipmentIds,
    request.studentLevel,
    windSpeed,
    request.date,
    request.timeSlot
  );

  const safetyCheck = equipmentService.checkEquipmentSafety(equipmentIds);

  request.equipmentIds = equipmentIds;
  request.checkResults.equipment = {
    ...result,
    safetyCheck,
    checkedAt: dayjs().toISOString()
  };
  request.updatedAt = dayjs().toISOString();

  if (result.success && !safetyCheck.needsReview) {
    request.status = FLIGHT_STATUS.EQUIPMENT_CHECK;
    request.history.push({
      status: FLIGHT_STATUS.EQUIPMENT_CHECK,
      timestamp: dayjs().toISOString(),
      note: '装备检查通过'
    });
  } else {
    request.status = FLIGHT_STATUS.NEEDS_REVIEW;
    request.history.push({
      status: FLIGHT_STATUS.NEEDS_REVIEW,
      timestamp: dayjs().toISOString(),
      note: '装备检查异常，需要复核'
    });
  }

  return {
    success: result.success,
    data: request,
    result,
    safetyCheck,
    needsReview: result.needsReview || safetyCheck.needsReview || !result.success,
    nextStep: (result.success && !safetyCheck.needsReview) ? '提交审批' : '需要人工复核'
  };
}

function submitForApproval(requestId) {
  const request = flightRequests.find(fr => fr.id === requestId);
  if (!request) {
    return { success: false, error: '飞行申请不存在' };
  }

  if (!canTransitionTo(request.status, FLIGHT_STATUS.PENDING_APPROVAL)) {
    return {
      success: false,
      error: '非法状态流转',
      currentStatus: request.status,
      message: '请确保天气、教练、装备检查均已通过',
      needsReview: true
    };
  }

  const checks = request.checkResults;
  const missingChecks = [];
  
  if (!checks.weather?.success) missingChecks.push('天气检查');
  if (!checks.scheduling?.availability?.success) missingChecks.push('教练排班检查');
  if (!checks.equipment?.success) missingChecks.push('装备检查');

  if (missingChecks.length > 0) {
    request.status = FLIGHT_STATUS.NEEDS_REVIEW;
    request.history.push({
      status: FLIGHT_STATUS.NEEDS_REVIEW,
      timestamp: dayjs().toISOString(),
      note: `缺少前置检查: ${missingChecks.join(', ')}`
    });
    
    return {
      success: false,
      error: '前置检查未完成',
      missingChecks,
      needsReview: true
    };
  }

  request.status = FLIGHT_STATUS.PENDING_APPROVAL;
  request.history.push({
    status: FLIGHT_STATUS.PENDING_APPROVAL,
    timestamp: dayjs().toISOString(),
    note: '已提交审批'
  });
  request.updatedAt = dayjs().toISOString();

  return {
    success: true,
    data: request,
    nextStep: '等待审批'
  };
}

function approveFlight(requestId, approver, notes) {
  const request = flightRequests.find(fr => fr.id === requestId);
  if (!request) {
    return { success: false, error: '飞行申请不存在' };
  }

  if (request.status !== FLIGHT_STATUS.PENDING_APPROVAL && request.status !== FLIGHT_STATUS.NEEDS_REVIEW) {
    return {
      success: false,
      error: '非法状态流转',
      currentStatus: request.status,
      message: '只能审批待审批或待复核的申请'
    };
  }

  request.status = FLIGHT_STATUS.APPROVED;
  request.history.push({
    status: FLIGHT_STATUS.APPROVED,
    timestamp: dayjs().toISOString(),
    note: `审批通过 - ${approver}`,
    notes
  });
  request.updatedAt = dayjs().toISOString();

  approvalLogs.push({
    id: createId(),
    requestId: request.id,
    action: 'approve',
    approver,
    notes,
    timestamp: dayjs().toISOString()
  });

  return {
    success: true,
    data: request,
    approvalLog: approvalLogs[approvalLogs.length - 1],
    nextStep: '可以开始飞行'
  };
}

function rejectFlight(requestId, approver, reason) {
  const request = flightRequests.find(fr => fr.id === requestId);
  if (!request) {
    return { success: false, error: '飞行申请不存在' };
  }

  if (request.status !== FLIGHT_STATUS.PENDING_APPROVAL && request.status !== FLIGHT_STATUS.NEEDS_REVIEW) {
    return {
      success: false,
      error: '非法状态流转',
      currentStatus: request.status
    };
  }

  request.status = FLIGHT_STATUS.REJECTED;
  request.history.push({
    status: FLIGHT_STATUS.REJECTED,
    timestamp: dayjs().toISOString(),
    note: `审批拒绝 - ${approver}: ${reason}`,
    reason
  });
  request.updatedAt = dayjs().toISOString();

  approvalLogs.push({
    id: createId(),
    requestId: request.id,
    action: 'reject',
    approver,
    notes: reason,
    timestamp: dayjs().toISOString()
  });

  return {
    success: true,
    data: request,
    approvalLog: approvalLogs[approvalLogs.length - 1]
  };
}

function manualReview(requestId, reviewer, decision, corrections) {
  const request = flightRequests.find(fr => fr.id === requestId);
  if (!request) {
    return { success: false, error: '飞行申请不存在' };
  }

  if (request.status !== FLIGHT_STATUS.NEEDS_REVIEW) {
    return {
      success: false,
      error: '该申请不需要复核',
      currentStatus: request.status
    };
  }

  const log = {
    id: createId(),
    requestId: request.id,
    action: 'manual_review',
    reviewer,
    decision,
    corrections,
    timestamp: dayjs().toISOString()
  };

  approvalLogs.push(log);

  if (corrections) {
    if (corrections.coachId !== undefined) {
      request.coachId = corrections.coachId;
      request.coachName = coaches.find(c => c.id === corrections.coachId)?.name;
    }
    if (corrections.weatherId !== undefined) {
      request.weatherId = corrections.weatherId;
    }
    if (corrections.equipmentIds !== undefined) {
      request.equipmentIds = corrections.equipmentIds;
    }
  }

  if (decision === 'approve') {
    request.status = FLIGHT_STATUS.PENDING_APPROVAL;
    request.history.push({
      status: FLIGHT_STATUS.PENDING_APPROVAL,
      timestamp: dayjs().toISOString(),
      note: `人工复核通过，提交审批 - ${reviewer}`,
      corrections
    });
  } else if (decision === 'reject') {
    request.status = FLIGHT_STATUS.REJECTED;
    request.history.push({
      status: FLIGHT_STATUS.REJECTED,
      timestamp: dayjs().toISOString(),
      note: `人工复核拒绝 - ${reviewer}`,
      corrections
    });
  }

  request.updatedAt = dayjs().toISOString();

  return {
    success: true,
    data: request,
    reviewLog: log,
    nextStep: decision === 'approve' ? '等待最终审批' : '流程结束'
  };
}

function completeFlight(requestId, reportData) {
  const request = flightRequests.find(fr => fr.id === requestId);
  if (!request) {
    return { success: false, error: '飞行申请不存在' };
  }

  if (request.status !== FLIGHT_STATUS.APPROVED && request.status !== FLIGHT_STATUS.IN_PROGRESS) {
    return {
      success: false,
      error: '非法状态流转',
      currentStatus: request.status
    };
  }

  request.status = FLIGHT_STATUS.COMPLETED;
  request.history.push({
    status: FLIGHT_STATUS.COMPLETED,
    timestamp: dayjs().toISOString(),
    note: '飞行完成'
  });
  request.updatedAt = dayjs().toISOString();

  const report = {
    id: createId(),
    requestId: request.id,
    studentId: request.studentId,
    studentName: request.studentName,
    coachId: request.coachId,
    coachName: request.coachName,
    date: request.date,
    timeSlot: request.timeSlot,
    flightDuration: reportData.flightDuration || 0,
    altitude: reportData.altitude || 0,
    weatherConditions: reportData.weatherConditions || {},
    incidents: reportData.incidents || [],
    notes: reportData.notes || '',
    safetyRating: reportData.safetyRating || 'normal',
    createdAt: dayjs().toISOString()
  };

  safetyReports.push(report);

  return {
    success: true,
    data: request,
    report,
    nextStep: '流程结束'
  };
}

function getFlightRequest(id) {
  return flightRequests.find(fr => fr.id === id);
}

function getAllFlightRequests(status) {
  if (status) {
    return flightRequests.filter(fr => fr.status === status);
  }
  return flightRequests;
}

function exportSafetyReports(startDate, endDate) {
  let reports = [...safetyReports];
  
  if (startDate) {
    reports = reports.filter(r => r.date >= startDate);
  }
  if (endDate) {
    reports = reports.filter(r => r.date <= endDate);
  }

  const summary = {
    totalFlights: reports.length,
    incidents: reports.filter(r => r.incidents.length > 0).length,
    averageDuration: reports.length > 0 
      ? (reports.reduce((sum, r) => sum + r.flightDuration, 0) / reports.length).toFixed(1)
      : 0,
    safetyRatings: {
      normal: reports.filter(r => r.safetyRating === 'normal').length,
      caution: reports.filter(r => r.safetyRating === 'caution').length,
      incident: reports.filter(r => r.safetyRating === 'incident').length
    }
  };

  return {
    success: true,
    data: {
      summary,
      reports,
      generatedAt: dayjs().toISOString()
    }
  };
}

module.exports = {
  createFlightRequest,
  checkWeatherWindow,
  checkCoachSchedule,
  checkEquipmentSelection,
  submitForApproval,
  approveFlight,
  rejectFlight,
  manualReview,
  completeFlight,
  getFlightRequest,
  getAllFlightRequests,
  exportSafetyReports,
  canTransitionTo,
  validateRequestFields,
  STATUS_FLOW,
  FLIGHT_STATUS
};
