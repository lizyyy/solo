class Driver {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.phone = data.phone;
    this.status = data.status || 'available';
    this.vehicleId = data.vehicleId || null;
    this.rating = data.rating || 4.5;
    this.experienceYears = data.experienceYears || 1;
    this.currentDispatchId = data.currentDispatchId || null;
    this.notificationHistory = data.notificationHistory || [];
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  updateStatus(newStatus, reason) {
    const oldStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date();

    return {
      driverId: this.id,
      name: this.name,
      oldStatus,
      newStatus,
      reason,
      updatedAt: this.updatedAt
    };
  }

  assignVehicle(vehicleId) {
    this.vehicleId = vehicleId;
    this.updatedAt = new Date();

    return {
      driverId: this.id,
      name: this.name,
      vehicleId,
      updatedAt: this.updatedAt
    };
  }

  unassignVehicle() {
    const oldVehicleId = this.vehicleId;
    this.vehicleId = null;
    this.updatedAt = new Date();

    return {
      driverId: this.id,
      name: this.name,
      oldVehicleId,
      updatedAt: this.updatedAt
    };
  }

  addNotification(notification) {
    const notificationRecord = {
      ...notification,
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date()
    };
    this.notificationHistory.unshift(notificationRecord);
    this.updatedAt = new Date();

    return notificationRecord;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      status: this.status,
      vehicleId: this.vehicleId,
      rating: this.rating,
      experienceYears: this.experienceYears,
      currentDispatchId: this.currentDispatchId,
      notificationHistory: this.notificationHistory,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  static fromJSON(json) {
    return new Driver(json);
  }

  validate() {
    const errors = [];

    if (!this.id) errors.push('司机ID不能为空');
    if (!this.name) errors.push('司机姓名不能为空');

    if (!['available', 'on_duty', 'on_break', 'off_duty'].includes(this.status)) {
      errors.push(`无效的司机状态: ${this.status}`);
    }

    if (this.rating && (this.rating < 0 || this.rating > 5)) {
      errors.push('司机评分必须在 0-5 之间');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = Driver;
