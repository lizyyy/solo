class Carrier {
  static generateId(carrierCode, name) {
    return `CAR_${carrierCode.toUpperCase()}`;
  }

  constructor(data) {
    this.carrierId = Carrier.generateId(data.carrierCode, data.name);
    this.carrierCode = data.carrierCode.toUpperCase();
    this.name = data.name;
    this.cutoffTime = data.cutoffTime;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      carrierId: this.carrierId,
      carrierCode: this.carrierCode,
      name: this.name,
      cutoffTime: this.cutoffTime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Carrier;
