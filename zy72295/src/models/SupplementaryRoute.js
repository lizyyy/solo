const { v4: uuidv4 } = require('uuid');

class SupplementaryRoute {
  constructor(data) {
    this.id = uuidv4();
    this.name = data.name || '';
    this.createdAt = new Date().toISOString();
    this.createdBy = data.createdBy || '';
    this.points = data.points || [];
    this.length = data.length || 0;
    this.linkedMeasurementId = data.linkedMeasurementId || null;
    this.linkedCADLayerId = data.linkedCADLayerId || null;
    this.lengthRecalculated = false;
    this.needsCustomerReview = false;
    this.customerReviewStatus = 'pending';
    this.remark = data.remark || '';
    this.status = 'draft';
  }

  needsLengthRecalculation() {
    return !this.lengthRecalculated;
  }

  recalculateLength() {
    if (this.points.length < 2) {
      this.length = 0;
      this.lengthRecalculated = true;
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
    this.length = Math.round(total * 100) / 100;
    this.lengthRecalculated = true;
    return this.length;
  }

  markForCustomerReview() {
    this.needsCustomerReview = true;
    this.customerReviewStatus = 'pending';
    this.status = 'reviewing';
  }

  completeCustomerReview(approved, reviewerRemark = '') {
    this.customerReviewStatus = approved ? 'approved' : 'rejected';
    this.needsCustomerReview = !approved;
    this.status = approved ? 'normal' : 'rejected';
    this.reviewerRemark = reviewerRemark;
  }
}

module.exports = { SupplementaryRoute };
