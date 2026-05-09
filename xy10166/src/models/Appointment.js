const { ResourceType } = require('./ResourceTypes');

class Appointment {
  constructor(data) {
    this.id = data.id || this._generateId();
    this.patientId = data.patientId;
    this.patientName = data.patientName;
    this.startTime = new Date(data.startTime);
    this.endTime = new Date(data.endTime);
    this.doctorId = data.doctorId;
    this.roomId = data.roomId;
    this.equipmentId = data.equipmentId || null;
    this.appointmentType = data.appointmentType || 'regular';
    this.description = data.description || '';
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  _generateId() {
    return 'apt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getResources() {
    const resources = [];
    if (this.doctorId) {
      resources.push({ id: this.doctorId, type: ResourceType.DOCTOR });
    }
    if (this.roomId) {
      resources.push({ id: this.roomId, type: ResourceType.ROOM });
    }
    if (this.equipmentId) {
      resources.push({ id: this.equipmentId, type: ResourceType.EQUIPMENT });
    }
    return resources;
  }

  spansMidnight() {
    const startDate = this.startTime.toDateString();
    const endDate = this.endTime.toDateString();
    return startDate !== endDate;
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      patientName: this.patientName,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime.toISOString(),
      doctorId: this.doctorId,
      roomId: this.roomId,
      equipmentId: this.equipmentId,
      appointmentType: this.appointmentType,
      description: this.description,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      spansMidnight: this.spansMidnight()
    };
  }

  validate() {
    const errors = [];
    
    if (!this.patientId) {
      errors.push('缺少患者ID');
    }
    
    if (!this.patientName) {
      errors.push('缺少患者姓名');
    }
    
    if (!this.doctorId) {
      errors.push('缺少医生ID');
    }
    
    if (!this.roomId) {
      errors.push('缺少诊室ID');
    }
    
    if (!(this.startTime instanceof Date) || isNaN(this.startTime.getTime())) {
      errors.push('开始时间格式无效');
    }
    
    if (!(this.endTime instanceof Date) || isNaN(this.endTime.getTime())) {
      errors.push('结束时间格式无效');
    }
    
    if (this.startTime >= this.endTime) {
      errors.push('开始时间必须早于结束时间');
    }
    
    return errors;
  }
}

module.exports = Appointment;
