const { DISPATCH_STATUS } = require('../config');

class Dispatch {
  constructor(data) {
    this.id = data.id || `DISP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    this.flightId = data.flightId;
    this.vehicleId = data.vehicleId;
    this.driverId = data.driverId;
    this.status = data.status || DISPATCH_STATUS.PENDING;
    this.pickupTime = data.pickupTime ? new Date(data.pickupTime) : null;
    this.actualPickupTime = data.actualPickupTime ? new Date(data.actualPickupTime) : null;
    this.dropoffTime = data.dropoffTime ? new Date(data.dropoffTime) : null;
    this.notes = data.notes || '';
    this.reason = data.reason || '';
    this.conflicts = data.conflicts || [];
    this.history = data.history || [];
    this.notifications = data.notifications || [];
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  updateStatus(newStatus, reason, details = {}) {
    const oldStatus = this.status;
    this.status = newStatus;
    this.reason = reason || this.reason;
    this.updatedAt = new Date();

    this.history.push({
      from: oldStatus,
      to: newStatus,
      reason,
      details,
      timestamp: this.updatedAt
    });

    return {
      dispatchId: this.id,
      oldStatus,
      newStatus,
      reason,
      details,
      updatedAt: this.updatedAt
    };
  }

  addConflict(conflict) {
    const conflictRecord = {
      id: `CONF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...conflict,
      detectedAt: new Date(),
      resolved: false
    };
    this.conflicts.push(conflictRecord);
    this.status = DISPATCH_STATUS.CONFLICT;
    this.updatedAt = new Date();

    return conflictRecord;
  }

  resolveConflict(conflictId, resolution) {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (conflict) {
      conflict.resolved = true;
      conflict.resolution = resolution;
      conflict.resolvedAt = new Date();
      this.updatedAt = new Date();
    }
    return conflict;
  }

  addNotification(notification) {
    const notificationRecord = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...notification,
      sentAt: new Date()
    };
    this.notifications.push(notificationRecord);
    this.updatedAt = new Date();

    return notificationRecord;
  }

  toJSON() {
    return {
      id: this.id,
      flightId: this.flightId,
      vehicleId: this.vehicleId,
      driverId: this.driverId,
      status: this.status,
      pickupTime: this.pickupTime ? this.pickupTime.toISOString() : null,
      actualPickupTime: this.actualPickupTime ? this.actualPickupTime.toISOString() : null,
      dropoffTime: this.dropoffTime ? this.dropoffTime.toISOString() : null,
      notes: this.notes,
      reason: this.reason,
      conflicts: this.conflicts,
      history: this.history,
      notifications: this.notifications,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  static fromJSON(json) {
    return new Dispatch(json);
  }

  validate() {
    const errors = [];

    if (!this.flightId) errors.push('航班ID不能为空');
    if (!this.vehicleId) errors.push('车辆ID不能为空');
    if (!this.driverId) errors.push('司机ID不能为空');

    if (!Object.values(DISPATCH_STATUS).includes(this.status)) {
      errors.push(`无效的调派状态: ${this.status}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = Dispatch;
