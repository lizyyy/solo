const crypto = require('crypto');

const CONFLICT_TYPES = {
  YARD_COORDINATE: 'yard_coordinate',
  POSITION_OCCUPANCY: 'position_occupancy',
  MULTI_SOURCE: 'multi_source',
  SHIFT_CHAIN_BROKEN: 'shift_chain_broken',
};

const STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  BLOCKED: 'blocked',
};

const SOURCE_TYPES = {
  GATE_SYSTEM: 'gate_system',
  YARD_INVENTORY: 'yard_inventory',
  TALLY_RECORD: 'tally_record',
};

class ContainerPosition {
  constructor(data) {
    this.containerNo = data.containerNo;
    this.originalPosition = data.originalPosition;
    this.currentPosition = data.currentPosition || data.originalPosition;
    this.source = data.source;
    this.timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    this.isShifted = data.isShifted || false;
    this.shiftHistory = data.shiftHistory || [];
    this.metadata = data.metadata || {};
  }

  toJSON() {
    return {
      containerNo: this.containerNo,
      originalPosition: this.originalPosition,
      currentPosition: this.currentPosition,
      source: this.source,
      timestamp: this.timestamp.toISOString(),
      isShifted: this.isShifted,
      shiftHistory: this.shiftHistory,
      metadata: this.metadata,
    };
  }
}

class ShiftRecord {
  constructor(data) {
    this.containerNo = data.containerNo;
    this.fromPosition = data.fromPosition;
    this.toPosition = data.toPosition;
    this.operator = data.operator;
    this.timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    this.reason = data.reason;
    this.sequence = data.sequence;
    this.checksum = this.generateChecksum();
  }

  generateChecksum() {
    const str = `${this.containerNo}-${this.fromPosition}-${this.toPosition}-${this.timestamp.getTime()}`;
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
  }

  toJSON() {
    return {
      containerNo: this.containerNo,
      fromPosition: this.fromPosition,
      toPosition: this.toPosition,
      operator: this.operator,
      timestamp: this.timestamp.toISOString(),
      reason: this.reason,
      sequence: this.sequence,
      checksum: this.checksum,
    };
  }
}

class Conflict {
  constructor(data) {
    this.id = data.id || `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.type = data.type;
    this.containerNo = data.containerNo;
    this.description = data.description;
    this.sourceRecords = data.sourceRecords || [];
    this.affectedPositions = data.affectedPositions || [];
    this.severity = data.severity || 'medium';
    this.status = data.status || STATUS.PENDING;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.resolvedAt = data.resolvedAt;
    this.resolution = data.resolution;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      containerNo: this.containerNo,
      description: this.description,
      sourceRecords: this.sourceRecords,
      affectedPositions: this.affectedPositions,
      severity: this.severity,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      resolvedAt: this.resolvedAt ? this.resolvedAt.toISOString() : null,
      resolution: this.resolution,
    };
  }
}

class CheckRecord {
  constructor(data) {
    this.id = data.id || `check-${Date.now()}`;
    this.timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    this.inputFiles = data.inputFiles || [];
    this.checksum = data.checksum;
    this.totalContainers = data.totalContainers || 0;
    this.conflicts = data.conflicts || [];
    this.status = data.status || 'completed';
    this.isDuplicate = data.isDuplicate || false;
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp.toISOString(),
      inputFiles: this.inputFiles,
      checksum: this.checksum,
      totalContainers: this.totalContainers,
      conflicts: this.conflicts.map(c => c.id || c),
      status: this.status,
      isDuplicate: this.isDuplicate,
    };
  }
}

module.exports = {
  CONFLICT_TYPES,
  STATUS,
  SOURCE_TYPES,
  ContainerPosition,
  ShiftRecord,
  Conflict,
  CheckRecord,
};
