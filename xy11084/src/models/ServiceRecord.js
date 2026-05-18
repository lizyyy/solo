class ServiceRecord {
  constructor(data) {
    this.id = data.id;
    this.volunteerId = data.volunteerId;
    this.volunteerName = data.volunteerName;
    this.serviceDate = data.serviceDate;
    this.serviceProject = data.serviceProject;
    this.serviceLocation = data.serviceLocation;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.serviceHours = data.serviceHours;
    this.checkInMethod = data.checkInMethod;
    this.checkInStatus = data.checkInStatus;
    this.witness = data.witness;
    this.evidenceId = data.evidenceId;
    this.publicityStatus = data.publicityStatus || 'pending';
    this.publicityDate = data.publicityDate;
    this.remarks = data.remarks;
    this.isLateMakeup = data.isLateMakeup || false;
    this.isProxySign = data.isProxySign || false;
    this.proxySigner = data.proxySigner;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.volunteerId) errors.push('志愿者ID不能为空');
    if (!this.volunteerName) errors.push('志愿者姓名不能为空');
    if (!this.serviceDate) errors.push('服务日期不能为空');
    if (!this.serviceProject) errors.push('服务项目不能为空');
    if (!this.serviceHours) errors.push('服务时长不能为空');
    if (this.serviceHours <= 0) errors.push('服务时长必须大于0');
    if (this.isProxySign && !this.proxySigner) {
      errors.push('代签必须填写代签人信息');
    }
    return errors;
  }

  calculateHours() {
    if (this.startTime && this.endTime) {
      const start = new Date(`${this.serviceDate} ${this.startTime}`);
      const end = new Date(`${this.serviceDate} ${this.endTime}`);
      const diff = (end - start) / (1000 * 60 * 60);
      return Math.round(diff * 100) / 100;
    }
    return this.serviceHours;
  }
}

module.exports = ServiceRecord;