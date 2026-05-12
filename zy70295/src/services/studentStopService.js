const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const store = require('../store');

class StudentStopService {
  getStudentStops(filters = {}) {
    let results = Array.from(store.studentStops.values());

    if (filters.routeId) {
      results = results.filter(s => s.routeId === filters.routeId);
    }
    if (filters.isTemporary !== undefined) {
      results = results.filter(s => s.isTemporary === filters.isTemporary);
    }
    if (filters.status) {
      results = results.filter(s => s.status === filters.status);
    }
    if (filters.scheduledDate) {
      results = results.filter(s => s.scheduledDate === filters.scheduledDate);
    }

    return { success: true, data: results };
  }

  getStudentStopById(stopId) {
    const stop = store.studentStops.get(stopId);
    if (!stop) {
      return { success: false, error: '学生站点不存在' };
    }

    let safetyRecord = null;
    if (stop.safetyRecordId) {
      safetyRecord = store.safetyRecords.get(stop.safetyRecordId);
    }

    return { success: true, data: { ...stop, safetyRecord } };
  }

  confirmStudentStop(stopId, data) {
    const { actualTime, actualStudentCount, confirmedBy } = data;
    const stop = store.studentStops.get(stopId);
    
    if (!stop) {
      return { success: false, error: '学生站点不存在' };
    }

    if (stop.status === 'completed') {
      return { success: false, error: '站点已完成，不能重复确认' };
    }

    stop.actualTime = actualTime || moment().format('HH:mm');
    stop.actualStudentCount = actualStudentCount || stop.studentCount;
    stop.status = 'completed';
    stop.updatedAt = moment().toISOString();

    if (stop.temporaryRequestId) {
      const request = store.temporaryStopRequests.get(stop.temporaryRequestId);
      if (request) {
        request.actualTime = stop.actualTime;
        request.actualStudentCount = stop.actualStudentCount;
        request.updatedAt = moment().toISOString();
      }
    }

    return { success: true, data: stop };
  }
}

module.exports = new StudentStopService();