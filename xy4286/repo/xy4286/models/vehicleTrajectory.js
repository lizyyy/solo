const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class VehicleTrajectory {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.vehiclePlate = options.vehiclePlate || '';
    this.batchId = options.batchId || null;
    this.boxId = options.boxId || null;
    this.points = options.points || [];
    this.source = options.source || 'gps';
    this.startTime = options.startTime || null;
    this.endTime = options.endTime || null;
    this.totalDistance = options.totalDistance || 0;
    this.createdAt = options.createdAt || moment().toISOString();
  }

  addPoint(latitude, longitude, timestamp) {
    this.points.push({
      latitude,
      longitude,
      timestamp: timestamp || moment().toISOString()
    });
    this.points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return this;
  }

  getDuration() {
    if (!this.startTime || !this.endTime) {
      if (this.points.length < 2) return 0;
      const first = this.points[0];
      const last = this.points[this.points.length - 1];
      return moment(last.timestamp).diff(moment(first.timestamp), 'minutes');
    }
    return moment(this.endTime).diff(moment(this.startTime), 'minutes');
  }

  toJSON() {
    return {
      id: this.id,
      vehiclePlate: this.vehiclePlate,
      batchId: this.batchId,
      boxId: this.boxId,
      points: this.points,
      source: this.source,
      startTime: this.startTime,
      endTime: this.endTime,
      totalDistance: this.totalDistance,
      durationMinutes: this.getDuration(),
      createdAt: this.createdAt
    };
  }

  static fromJSON(json) {
    return new VehicleTrajectory(json);
  }
}

module.exports = VehicleTrajectory;
