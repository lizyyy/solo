class Wave {
  static STATUS = {
    PREVIEW: 'PREVIEW',
    CONFIRMED: 'CONFIRMED',
    RELEASED: 'RELEASED',
    PICKING: 'PICKING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
  };

  static generateId(zone, carrierCode, sequence) {
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `WAVE_${zone}_${carrierCode}_${ts}_${String(sequence).padStart(3, '0')}`;
  }

  static generateKey(zone, carrierCode) {
    return `${zone}|${carrierCode}`;
  }

  constructor(data) {
    this.waveId = data.waveId;
    this.waveKey = Wave.generateKey(data.zone, data.carrierCode);
    this.zone = data.zone;
    this.carrierId = Carrier.generateId(data.carrierCode, data.carrierName || '');
    this.carrierCode = data.carrierCode;
    this.carrierName = data.carrierName || null;
    this.status = data.status || Wave.STATUS.PREVIEW;
    this.orderIds = data.orderIds || [];
    this.allocations = data.allocations || [];
    this.cutoffTime = data.cutoffTime || null;
    this.generatedAt = data.generatedAt || new Date().toISOString();
    this.confirmedAt = data.confirmedAt || null;
    this.releasedAt = data.releasedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  get isPreview() {
    return this.status === Wave.STATUS.PREVIEW;
  }

  get isConfirmed() {
    return this.status === Wave.STATUS.CONFIRMED;
  }

  get isFailed() {
    return this.status === Wave.STATUS.FAILED;
  }

  toJSON() {
    return {
      waveId: this.waveId,
      waveKey: this.waveKey,
      zone: this.zone,
      carrierId: this.carrierId,
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      status: this.status,
      orderIds: this.orderIds,
      allocations: this.allocations,
      cutoffTime: this.cutoffTime,
      generatedAt: this.generatedAt,
      confirmedAt: this.confirmedAt,
      releasedAt: this.releasedAt,
      isPreview: this.isPreview,
      isConfirmed: this.isConfirmed,
      isFailed: this.isFailed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

const Carrier = require('./Carrier');
module.exports = Wave;
