const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const store = require('../store');

class TemporaryStopService {
  createRequest(data) {
    const { routeId, originalStopId, temporaryStopName, temporaryStopAddress, reason, effectiveDate, estimatedTime, requestedBy, idempotencyKey } = data;
    
    if (idempotencyKey) {
      const existing = store.checkIdempotency(idempotencyKey);
      if (existing.exists) {
        return { success: true, data: existing.result.result, isDuplicate: true };
      }
    }

    const route = store.busRoutes.get(routeId);
    if (!route) {
      return { success: false, error: '校车线路不存在' };
    }

    const originalStop = route.scheduledStops.find(s => s.stopId === originalStopId);
    if (!originalStop) {
      return { success: false, error: '原始站点不存在' };
    }

    const requestId = uuidv4();
    const request = {
      id: requestId,
      routeId,
      originalStopId,
      originalStopName: originalStop.stopName,
      originalStopAddress: originalStop.stopAddress,
      temporaryStopName,
      temporaryStopAddress,
      reason,
      effectiveDate: effectiveDate || moment().format('YYYY-MM-DD'),
      estimatedTime: estimatedTime || originalStop.scheduledTime,
      studentCount: originalStop.studentCount,
      status: 'pending',
      requestedBy,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString()
    };

    store.temporaryStopRequests.set(requestId, request);

    if (idempotencyKey) {
      store.saveIdempotencyResult(idempotencyKey, request);
    }

    return { success: true, data: request };
  }

  advanceRequest(requestId, data) {
    const { action, processedBy, correctionData } = data;
    const request = store.temporaryStopRequests.get(requestId);
    
    if (!request) {
      return { success: false, error: '临停申请不存在' };
    }

    let newStatus;
    let validationError = null;

    switch (action) {
      case 'approve':
        if (request.status !== 'pending') {
          validationError = '只有待审批的申请才能批准';
        }
        newStatus = 'approved';
        break;
      case 'implement':
        if (request.status !== 'approved') {
          validationError = '只有已批准的申请才能执行';
        }
        newStatus = 'implemented';
        break;
      case 'complete':
        if (request.status !== 'implemented') {
          validationError = '只有已执行的申请才能完成';
        }
        newStatus = 'completed';
        break;
      case 'cancel':
        if (request.status === 'completed') {
          validationError = '已完成的申请不能取消';
        }
        newStatus = 'cancelled';
        break;
      default:
        validationError = '不支持的操作';
    }

    if (validationError) {
      return { success: false, error: validationError };
    }

    request.status = newStatus;
    request.updatedAt = moment().toISOString();
    request.processedBy = processedBy;

    if (newStatus === 'implemented') {
      const studentStopResult = this._createTemporaryStudentStop(request);
      if (!studentStopResult.success) {
        return studentStopResult;
      }
      request.createdStudentStopId = studentStopResult.data.id;
    }

    if (newStatus === 'completed' && correctionData) {
      this._correctRequest(requestId, correctionData);
    }

    return { success: true, data: request };
  }

  withdrawRequest(requestId, data) {
    const { reason, processedBy } = data;
    const request = store.temporaryStopRequests.get(requestId);
    
    if (!request) {
      return { success: false, error: '临停申请不存在' };
    }

    if (request.status === 'completed') {
      return { success: false, error: '已完成的申请不能撤回' };
    }

    if (request.createdStudentStopId) {
      const studentStop = store.studentStops.get(request.createdStudentStopId);
      if (studentStop && studentStop.status === 'pending') {
        studentStop.status = 'cancelled';
        studentStop.updatedAt = moment().toISOString();
      }
    }

    request.status = 'withdrawn';
    request.withdrawReason = reason;
    request.processedBy = processedBy;
    request.updatedAt = moment().toISOString();

    return { success: true, data: request };
  }

  correctRequest(requestId, data) {
    return this._correctRequest(requestId, data);
  }

  _correctRequest(requestId, data) {
    const request = store.temporaryStopRequests.get(requestId);
    if (!request) {
      return { success: false, error: '临停申请不存在' };
    }

    if (request.status !== 'completed' && request.status !== 'implemented') {
      return { success: false, error: '只有已执行或已完成的申请才能修正' };
    }

    if (data.temporaryStopName) request.temporaryStopName = data.temporaryStopName;
    if (data.temporaryStopAddress) request.temporaryStopAddress = data.temporaryStopAddress;
    if (data.reason) request.reason = data.reason;
    if (data.estimatedTime) request.estimatedTime = data.estimatedTime;
    if (data.actualTime) request.actualTime = data.actualTime;
    if (data.actualStudentCount) request.actualStudentCount = data.actualStudentCount;

    request.updatedAt = moment().toISOString();

    if (request.createdStudentStopId) {
      const studentStop = store.studentStops.get(request.createdStudentStopId);
      if (studentStop) {
        if (data.temporaryStopName) studentStop.stopName = data.temporaryStopName;
        if (data.temporaryStopAddress) studentStop.stopAddress = data.temporaryStopAddress;
        if (data.actualTime) studentStop.actualTime = data.actualTime;
        if (data.actualStudentCount) studentStop.actualStudentCount = data.actualStudentCount;
        studentStop.updatedAt = moment().toISOString();
      }
    }

    return { success: true, data: request };
  }

  _createTemporaryStudentStop(request) {
    const stopId = uuidv4();
    const stop = {
      id: stopId,
      routeId: request.routeId,
      originalStopId: request.originalStopId,
      stopName: request.temporaryStopName,
      stopAddress: request.temporaryStopAddress,
      isTemporary: true,
      temporaryRequestId: request.id,
      scheduledDate: request.effectiveDate,
      scheduledTime: request.estimatedTime,
      actualTime: null,
      studentCount: request.studentCount,
      actualStudentCount: null,
      status: 'pending',
      safetyRecordId: null,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString()
    };

    store.studentStops.set(stopId, stop);
    return { success: true, data: stop };
  }

  getRequests(filters = {}) {
    let results = Array.from(store.temporaryStopRequests.values());

    if (filters.routeId) {
      results = results.filter(r => r.routeId === filters.routeId);
    }
    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }
    if (filters.effectiveDate) {
      results = results.filter(r => r.effectiveDate === filters.effectiveDate);
    }

    return { success: true, data: results };
  }

  getRequestById(requestId) {
    const request = store.temporaryStopRequests.get(requestId);
    if (!request) {
      return { success: false, error: '临停申请不存在' };
    }

    let studentStop = null;
    let safetyRecord = null;

    if (request.createdStudentStopId) {
      studentStop = store.studentStops.get(request.createdStudentStopId);
      if (studentStop && studentStop.safetyRecordId) {
        safetyRecord = store.safetyRecords.get(studentStop.safetyRecordId);
      }
    }

    return { success: true, data: { ...request, studentStop, safetyRecord } };
  }
}

module.exports = new TemporaryStopService();