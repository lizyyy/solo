const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { STATES } = require('./stateMachine');

class Station {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || '';
    this.address = options.address || '';
    this.contactPerson = options.contactPerson || '';
    this.contactPhone = options.contactPhone || '';
    this.latitude = options.latitude || 0;
    this.longitude = options.longitude || 0;
    this.status = options.status || STATES.STATION.ACTIVE;
    this.notes = options.notes || '';
    this.createdAt = options.createdAt || moment().toISOString();
    this.updatedAt = options.updatedAt || moment().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      address: this.address,
      contactPerson: this.contactPerson,
      contactPhone: this.contactPhone,
      latitude: this.latitude,
      longitude: this.longitude,
      status: this.status,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new Station(json);
  }
}

module.exports = Station;
