const { v4: uuidv4 } = require('uuid');
const timeUtils = require('../utils/time');

class Job {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.clientName = data.clientName || data.client_name || '';
    this.address = data.address || '';
    this.lat = parseFloat(data.lat) || 0;
    this.lng = parseFloat(data.lng) || 0;
    this.serviceType = data.serviceType || data.service_type || '';
    this.timeWindowStart = data.timeWindowStart || data.time_window_start || '08:00';
    this.timeWindowEnd = data.timeWindowEnd || data.time_window_end || '18:00';
    this.serviceDuration = parseInt(data.serviceDuration || data.service_duration || 30, 10);
    this.priority = data.priority || 'medium';
    this.notes = data.notes || '';
    this.status = data.status || 'pending';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    this.validate();
  }

  validate() {
    const errors = [];
    
    if (!this.clientName) {
      errors.push('客户姓名不能为空');
    }
    
    if (!this.address) {
      errors.push('地址不能为空');
    }
    
    if (!this.lat || this.lat < -90 || this.lat > 90) {
      errors.push('纬度无效');
    }
    
    if (!this.lng || this.lng < -180 || this.lng > 180) {
      errors.push('经度无效');
    }
    
    if (!this.serviceType) {
      errors.push('服务类型不能为空');
    }
    
    try {
      timeUtils.parseTime(this.timeWindowStart);
      timeUtils.parseTime(this.timeWindowEnd);
    } catch (e) {
      errors.push(`时间窗格式错误: ${e.message}`);
    }
    
    if (timeUtils.timeToMinutes(this.timeWindowStart) >= timeUtils.timeToMinutes(this.timeWindowEnd)) {
      errors.push('时间窗开始时间必须早于结束时间');
    }
    
    if (this.serviceDuration <= 0) {
      errors.push('服务时长必须大于0');
    }
    
    if (!['high', 'medium', 'low'].includes(this.priority)) {
      errors.push('优先级只能是 high, medium, low');
    }
    
    if (errors.length > 0) {
      throw new Error(`任务数据验证失败: ${errors.join('; ')}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      clientName: this.clientName,
      address: this.address,
      lat: this.lat,
      lng: this.lng,
      serviceType: this.serviceType,
      timeWindowStart: this.timeWindowStart,
      timeWindowEnd: this.timeWindowEnd,
      serviceDuration: this.serviceDuration,
      priority: this.priority,
      notes: this.notes,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromCSVRow(row) {
    return new Job({
      id: row.id,
      clientName: row.client_name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      serviceType: row.service_type,
      timeWindowStart: row.time_window_start,
      timeWindowEnd: row.time_window_end,
      serviceDuration: row.service_duration,
      priority: row.priority,
      notes: row.notes
    });
  }

  getTimeWindowMinutes() {
    return {
      start: timeUtils.timeToMinutes(this.timeWindowStart),
      end: timeUtils.timeToMinutes(this.timeWindowEnd)
    };
  }
}

module.exports = Job;
