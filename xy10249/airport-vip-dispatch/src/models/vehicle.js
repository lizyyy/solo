const { VEHICLE_TYPES, VEHICLE_BASE_LOCATIONS } = require('../config');

class Vehicle {
  constructor(data) {
    this.id = data.id;
    this.plateNumber = data.plateNumber;
    this.type = data.type;
    this.capacity = data.capacity || 4;
    this.status = data.status || 'available';
    this.currentLocation = data.currentLocation;
    this.baseLocation = data.baseLocation || 'BASE-MAIN';
    this.driverId = data.driverId || null;
    this.lastMaintenance = data.lastMaintenance ? new Date(data.lastMaintenance) : null;
    this.features = data.features || [];
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  updateStatus(newStatus, reason) {
    const oldStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date();

    return {
      vehicleId: this.id,
      plateNumber: this.plateNumber,
      oldStatus,
      newStatus,
      reason,
      updatedAt: this.updatedAt
    };
  }

  assignDriver(driverId) {
    this.driverId = driverId;
    this.updatedAt = new Date();

    return {
      vehicleId: this.id,
      plateNumber: this.plateNumber,
      driverId,
      updatedAt: this.updatedAt
    };
  }

  unassignDriver() {
    const oldDriverId = this.driverId;
    this.driverId = null;
    this.updatedAt = new Date();

    return {
      vehicleId: this.id,
      plateNumber: this.plateNumber,
      oldDriverId,
      updatedAt: this.updatedAt
    };
  }

  getBaseInfo() {
    return VEHICLE_BASE_LOCATIONS[this.baseLocation] || VEHICLE_BASE_LOCATIONS['BASE-MAIN'];
  }

  toJSON() {
    return {
      id: this.id,
      plateNumber: this.plateNumber,
      type: this.type,
      capacity: this.capacity,
      status: this.status,
      currentLocation: this.currentLocation,
      baseLocation: this.baseLocation,
      driverId: this.driverId,
      lastMaintenance: this.lastMaintenance ? this.lastMaintenance.toISOString() : null,
      features: this.features,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  static fromJSON(json) {
    return new Vehicle(json);
  }

  validate() {
    const errors = [];

    if (!this.id) errors.push('车辆ID不能为空');
    if (!this.plateNumber) errors.push('车牌号不能为空');
    if (!this.type) errors.push('车型不能为空');

    if (this.type && !Object.values(VEHICLE_TYPES).includes(this.type)) {
      errors.push(`无效的车型: ${this.type}`);
    }

    if (this.baseLocation && !VEHICLE_BASE_LOCATIONS[this.baseLocation]) {
      errors.push(`无效的基地位置: ${this.baseLocation}`);
    }

    if (!['available', 'in_use', 'maintenance', 'reserved'].includes(this.status)) {
      errors.push(`无效的车辆状态: ${this.status}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = Vehicle;
