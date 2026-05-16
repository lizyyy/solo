const { v4: uuidv4 } = require('uuid');

const ROTATION_STATES = {
  PENDING: 'PENDING',
  DUAL_KEY_ACTIVE: 'DUAL_KEY_ACTIVE',
  OLD_KEY_DEPRECATED: 'OLD_KEY_DEPRECATED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

class VendorConfig {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.vendorId = data.vendorId;
    this.oldSecret = data.oldSecret;
    this.newSecret = data.newSecret;
    this.dualKeyStartTime = data.dualKeyStartTime || new Date().toISOString();
    this.dualKeyEndTime = data.dualKeyEndTime;
    this.oldKeyDeprecateTime = data.oldKeyDeprecateTime;
    this.rotationState = data.rotationState || ROTATION_STATES.PENDING;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  static get STATES() {
    return ROTATION_STATES;
  }

  isInDualKeyWindow() {
    const now = new Date();
    const startTime = new Date(this.dualKeyStartTime);
    const endTime = this.dualKeyEndTime ? new Date(this.dualKeyEndTime) : null;
    
    if (endTime) {
      return now >= startTime && now <= endTime;
    }
    return now >= startTime;
  }

  canUseOldKey() {
    if (this.rotationState === ROTATION_STATES.COMPLETED) {
      return false;
    }
    if (this.rotationState === ROTATION_STATES.OLD_KEY_DEPRECATED) {
      return false;
    }
    return this.isInDualKeyWindow();
  }

  canUseNewKey() {
    const now = new Date();
    return now >= new Date(this.dualKeyStartTime);
  }

  toJSON() {
    return {
      id: this.id,
      vendorId: this.vendorId,
      dualKeyStartTime: this.dualKeyStartTime,
      dualKeyEndTime: this.dualKeyEndTime,
      oldKeyDeprecateTime: this.oldKeyDeprecateTime,
      rotationState: this.rotationState,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }
}

module.exports = VendorConfig;