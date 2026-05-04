const { v4: uuidv4 } = require('uuid');
const timeUtils = require('../utils/time');

class Worker {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.phone = data.phone || '';
    this.skills = Array.isArray(data.skills) 
      ? data.skills 
      : (data.skills || '').split(',').map(s => s.trim()).filter(Boolean);
    this.startLocation = {
      lat: parseFloat(data.startLocation?.lat || data.start_location_lat || 0),
      lng: parseFloat(data.startLocation?.lng || data.start_location_lng || 0)
    };
    this.endLocation = {
      lat: parseFloat(data.endLocation?.lat || data.end_location_lat || 0),
      lng: parseFloat(data.endLocation?.lng || data.end_location_lng || 0)
    };
    this.workStartTime = data.workStartTime || data.work_start_time || '08:00';
    this.workEndTime = data.workEndTime || data.work_end_time || '18:00';
    this.lunchStart = data.lunchStart || data.lunch_start || '12:00';
    this.lunchEnd = data.lunchEnd || data.lunch_end || '13:00';
    this.maxJobsPerDay = parseInt(data.maxJobsPerDay || data.max_jobs_per_day || 10, 10);
    this.vehicleType = data.vehicleType || data.vehicle_type || 'electric_bike';
    this.status = data.status || 'active';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    this.validate();
  }

  validate() {
    const errors = [];
    
    if (!this.name) {
      errors.push('师傅姓名不能为空');
    }
    
    if (!this.skills || this.skills.length === 0) {
      errors.push('至少需要一项技能');
    }
    
    if (!this.startLocation.lat || !this.startLocation.lng) {
      errors.push('起点坐标无效');
    }
    
    if (!this.endLocation.lat || !this.endLocation.lng) {
      errors.push('终点坐标无效');
    }
    
    try {
      timeUtils.parseTime(this.workStartTime);
      timeUtils.parseTime(this.workEndTime);
      timeUtils.parseTime(this.lunchStart);
      timeUtils.parseTime(this.lunchEnd);
    } catch (e) {
      errors.push(`时间格式错误: ${e.message}`);
    }
    
    if (timeUtils.timeToMinutes(this.workStartTime) >= timeUtils.timeToMinutes(this.workEndTime)) {
      errors.push('工作开始时间必须早于结束时间');
    }
    
    if (timeUtils.timeToMinutes(this.lunchStart) >= timeUtils.timeToMinutes(this.lunchEnd)) {
      errors.push('午休开始时间必须早于结束时间');
    }
    
    if (this.maxJobsPerDay <= 0) {
      errors.push('每日最大任务数必须大于0');
    }
    
    if (!['car', 'electric_bike', 'bicycle'].includes(this.vehicleType)) {
      errors.push('车辆类型只能是 car, electric_bike, bicycle');
    }
    
    if (errors.length > 0) {
      throw new Error(`师傅数据验证失败: ${errors.join('; ')}`);
    }
  }

  hasSkill(skill) {
    return this.skills.includes(skill);
  }

  canServeJob(job) {
    return this.hasSkill(job.serviceType);
  }

  getWorkHoursMinutes() {
    return {
      start: timeUtils.timeToMinutes(this.workStartTime),
      end: timeUtils.timeToMinutes(this.workEndTime)
    };
  }

  getLunchMinutes() {
    return {
      start: timeUtils.timeToMinutes(this.lunchStart),
      end: timeUtils.timeToMinutes(this.lunchEnd)
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      skills: this.skills,
      startLocation: this.startLocation,
      endLocation: this.endLocation,
      workStartTime: this.workStartTime,
      workEndTime: this.workEndTime,
      lunchStart: this.lunchStart,
      lunchEnd: this.lunchEnd,
      maxJobsPerDay: this.maxJobsPerDay,
      vehicleType: this.vehicleType,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromCSVRow(row) {
    return new Worker({
      id: row.id,
      name: row.name,
      phone: row.phone,
      skills: row.skills,
      startLocation: {
        lat: row.start_location_lat,
        lng: row.start_location_lng
      },
      endLocation: {
        lat: row.end_location_lat,
        lng: row.end_location_lng
      },
      workStartTime: row.work_start_time,
      workEndTime: row.work_end_time,
      lunchStart: row.lunch_start,
      lunchEnd: row.lunch_end,
      maxJobsPerDay: row.max_jobs_per_day,
      vehicleType: row.vehicle_type
    });
  }
}

module.exports = Worker;
