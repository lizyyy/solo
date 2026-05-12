const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const store = require('../store');

class SafetyService {
  createSafetyRecord(data) {
    const { stopId, studentCount, boardingCount, alightingCount, safetyChecks, notes, recordedBy } = data;
    const stop = store.studentStops.get(stopId);
    
    if (!stop) {
      return { success: false, error: '学生站点不存在' };
    }

    if (stop.safetyRecordId) {
      return { success: false, error: '该站点已有安全记录，不能重复创建' };
    }

    const recordId = uuidv4();
    const record = {
      id: recordId,
      stopId,
      routeId: stop.routeId,
      stopName: stop.stopName,
      isTemporary: stop.isTemporary,
      studentCount: studentCount || stop.studentCount,
      boardingCount: boardingCount || 0,
      alightingCount: alightingCount || 0,
      safetyChecks: safetyChecks || {
        pedestrianSafety: true,
        trafficSafety: true,
        vehicleCondition: true,
        studentBehavior: true
      },
      notes: notes || '',
      recordedBy,
      recordedAt: moment().toISOString(),
      status: 'recorded',
      createdAt: moment().toISOString()
    };

    store.safetyRecords.set(recordId, record);
    stop.safetyRecordId = recordId;
    stop.updatedAt = moment().toISOString();

    return { success: true, data: record };
  }

  getSafetyRecords(filters = {}) {
    let results = Array.from(store.safetyRecords.values());

    if (filters.routeId) {
      results = results.filter(r => r.routeId === filters.routeId);
    }
    if (filters.stopId) {
      results = results.filter(r => r.stopId === filters.stopId);
    }
    if (filters.isTemporary !== undefined) {
      results = results.filter(r => r.isTemporary === filters.isTemporary);
    }
    if (filters.recordedDate) {
      results = results.filter(r => moment(r.recordedAt).format('YYYY-MM-DD') === filters.recordedDate);
    }

    return { success: true, data: results };
  }

  getSafetyRecordById(recordId) {
    const record = store.safetyRecords.get(recordId);
    if (!record) {
      return { success: false, error: '安全记录不存在' };
    }

    const stop = store.studentStops.get(record.stopId);
    return { success: true, data: { ...record, stop } };
  }
}

module.exports = new SafetyService();