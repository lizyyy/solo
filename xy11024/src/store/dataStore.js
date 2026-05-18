const { v4: uuidv4 } = require('uuid');
const { Schedule, SCHEDULE_STATUS } = require('../models/Schedule');

class DataStore {
  constructor() {
    this.schedules = new Map();
    this.importBatches = new Map();
    this.uniqueKeys = new Set();
  }

  generateUniqueKey(scheduleData) {
    return `${scheduleData.patientId}-${scheduleData.programCode}-${scheduleData.scheduledDate}-${scheduleData.scheduledTime}`;
  }

  isDuplicate(scheduleData) {
    const key = this.generateUniqueKey(scheduleData);
    return this.uniqueKeys.has(key);
  }

  createImportBatch() {
    const batchId = uuidv4();
    const batch = {
      id: batchId,
      createdAt: new Date().toISOString(),
      totalRows: 0,
      successRows: 0,
      errorRows: 0,
      warningRows: 0,
      status: 'processing'
    };
    this.importBatches.set(batchId, batch);
    return batch;
  }

  updateImportBatch(batchId, stats) {
    const batch = this.importBatches.get(batchId);
    if (batch) {
      Object.assign(batch, stats);
      batch.status = 'completed';
    }
    return batch;
  }

  addSchedule(scheduleData) {
    const schedule = new Schedule(scheduleData);
    
    if (this.isDuplicate(scheduleData)) {
      return {
        success: false,
        schedule: schedule.toJSON(),
        errors: [{
          field: 'duplicate',
          message: '重复提交：同一患者在相同时间已有相同项目排程',
          suggestion: '请核对排程信息或修改排程时间后重新导入',
          severity: 'error'
        }]
      };
    }

    const errors = schedule.validate();
    const hasErrors = errors.some(e => e.severity === 'error');
    
    if (hasErrors) {
      return {
        success: false,
        schedule: schedule.toJSON(),
        errors
      };
    }

    const key = this.generateUniqueKey(scheduleData);
    this.uniqueKeys.add(key);
    this.schedules.set(schedule.id, schedule);
    
    return {
      success: true,
      schedule: schedule.toJSON(),
      errors
    };
  }

  addScheduleWithReview(scheduleData, manualNotes) {
    const schedule = new Schedule(scheduleData);
    schedule.manualNotes = manualNotes;
    schedule.needsManualReview = false;
    schedule.status = SCHEDULE_STATUS.PENDING;
    
    if (this.isDuplicate(scheduleData)) {
      return {
        success: false,
        schedule: schedule.toJSON(),
        errors: [{
          field: 'duplicate',
          message: '重复提交：同一患者在相同时间已有相同项目排程',
          suggestion: '请核对排程信息或修改排程时间后重新导入',
          severity: 'error'
        }]
      };
    }

    const key = this.generateUniqueKey(scheduleData);
    this.uniqueKeys.add(key);
    this.schedules.set(schedule.id, schedule);
    
    return {
      success: true,
      schedule: schedule.toJSON(),
      errors: []
    };
  }

  getSchedule(id) {
    const schedule = this.schedules.get(id);
    return schedule ? schedule.toJSON() : null;
  }

  getAllSchedules() {
    return Array.from(this.schedules.values()).map(s => s.toJSON());
  }

  getSchedulesByBatch(batchId) {
    return this.getAllSchedules().filter(s => s.importBatchId === batchId);
  }

  getBatch(batchId) {
    return this.importBatches.get(batchId);
  }

  updateScheduleStatus(id, newStatus) {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      return { success: false, message: '排程记录不存在' };
    }

    if (newStatus === SCHEDULE_STATUS.CANCELLED) {
      schedule.status = newStatus;
      schedule.updatedAt = new Date().toISOString();
      return { success: true, schedule: schedule.toJSON() };
    }

    const statusFlow = [
      SCHEDULE_STATUS.PENDING,
      SCHEDULE_STATUS.CONFIRMED,
      SCHEDULE_STATUS.IN_PROGRESS,
      SCHEDULE_STATUS.COMPLETED
    ];

    const currentIndex = statusFlow.indexOf(schedule.status);
    const newIndex = statusFlow.indexOf(newStatus);

    if (newIndex === -1) {
      return { success: false, message: '无效的状态值' };
    }

    if (newIndex < currentIndex) {
      return { 
        success: false, 
        message: '状态不能回退',
        suggestion: `当前状态为 ${schedule.status}，不能改为 ${newStatus}`
      };
    }

    if (newIndex > currentIndex + 1) {
      return { 
        success: false, 
        message: '状态不能越级',
        suggestion: `当前状态为 ${schedule.status}，下一个状态应为 ${statusFlow[currentIndex + 1]}`
      };
    }

    schedule.status = newStatus;
    schedule.updatedAt = new Date().toISOString();
    return { success: true, schedule: schedule.toJSON() };
  }

  exportSchedules(batchId) {
    let schedules = this.getAllSchedules();
    if (batchId) {
      schedules = schedules.filter(s => s.importBatchId === batchId);
    }
    return schedules;
  }

  clear() {
    this.schedules.clear();
    this.importBatches.clear();
    this.uniqueKeys.clear();
  }
}

module.exports = new DataStore();
