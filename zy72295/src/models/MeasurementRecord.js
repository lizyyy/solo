const { v4: uuidv4 } = require('uuid');

class MeasurementRecord {
  constructor(data) {
    this.id = uuidv4();
    this.deviceId = data.deviceId || '';
    this.recordedAt = data.recordedAt || new Date().toISOString();
    this.recordedBy = data.recordedBy || '';
    this.points = data.points || [];
    this.calculatedLength = data.calculatedLength || 0;
    this.isManualEntry = data.isManualEntry || false;
    this.linkedCADLayerId = data.linkedCADLayerId || null;
    this.linkedRouteId = data.linkedRouteId || null;
    this.lengthRecalculated = false;
    this.needsReview = false;
    this.reviewStatus = 'pending';
    this.reviewedBy = null;
    this.reviewedAt = null;
  }

  calculateLength() {
    if (this.points.length < 2) {
      this.calculatedLength = 0;
      return 0;
    }
    let total = 0;
    for (let i = 1; i < this.points.length; i++) {
      const p1 = this.points[i - 1];
      const p2 = this.points[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = (p2.z || 0) - (p1.z || 0);
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    this.calculatedLength = Math.round(total * 100) / 100;
    this.lengthRecalculated = true;
    return this.calculatedLength;
  }

  markForReview(reason) {
    this.needsReview = true;
    this.reviewStatus = 'pending';
    this.reviewReason = reason;
  }

  completeReview(reviewer, approved) {
    this.reviewedBy = reviewer;
    this.reviewedAt = new Date().toISOString();
    this.reviewStatus = approved ? 'approved' : 'rejected';
    this.needsReview = !approved;
  }
}

module.exports = { MeasurementRecord };
