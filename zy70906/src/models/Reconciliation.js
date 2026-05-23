const { v4: uuidv4 } = require('uuid');

const RECON_STATUS = {
  PENDING: "pending",
  MATCHED: "matched",
  DISCREPANCY: "discrepancy",
  APPROVED: "approved",
  REJECTED: "rejected"
};

const DISCREPANCY_TYPES = {
  POINTS_MISMATCH: "points_mismatch",
  DUPLICATE_RECEIPT: "duplicate_receipt",
  RETURN_WITHOUT_ORIGINAL: "return_without_original",
  MANUAL_RECORD: "manual_record",
  MEMBER_LEVEL_MISMATCH: "member_level_mismatch",
  PROMOTION_MISMATCH: "promotion_mismatch",
  ASSOUNT_MISMATCH: "amount_mismatch"
};

class Reconciliation {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.receiptId = data.receiptId;
    this.receiptNo = data.receiptNo;
    this.memberNo = data.memberNo;
    this.expectedPoints = data.expectedPoints || 0;
    this.actualPoints = data.actualPoints || 0;
    this.pointsDiff = data.pointsDiff || 0;
    this.status = data.status || RECON_STATUS.PENDING;
    this.discrepancyTypes = data.discrepancyTypes || [];
    this.discrepancyReasons = data.discrepancyReasons || [];
    this.reviewer = data.reviewer || null;
    this.reviewRemark = data.reviewRemark || "";
    this.reviewedAt = data.reviewedAt || null;
    this.calculationDetails = data.calculationDetails || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  addDiscrepancy(type, reason) {
    if (!this.discrepancyTypes.includes(type)) {
      this.discrepancyTypes.push(type);
    }
    this.discrepancyReasons.push({ type, reason, timestamp: new Date().toISOString() });
    this.status = RECON_STATUS.DISCREPANCY;
  }

  approve(reviewer, remark) {
    this.reviewer = reviewer;
    this.reviewRemark = remark;
    this.reviewedAt = new Date().toISOString();
    this.status = RECON_STATUS.APPROVED;
    this.updatedAt = new Date().toISOString();
  }

  reject(reviewer, remark) {
    this.reviewer = reviewer;
    this.reviewRemark = remark;
    this.reviewedAt = new Date().toISOString();
    this.status = RECON_STATUS.REJECTED;
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      receiptId: this.receiptId,
      receiptNo: this.receiptNo,
      memberNo: this.memberNo,
      expectedPoints: this.expectedPoints,
      actualPoints: this.actualPoints,
      pointsDiff: this.pointsDiff,
      status: this.status,
      discrepancyTypes: this.discrepancyTypes,
      discrepancyReasons: this.discrepancyReasons,
      reviewer: this.reviewer,
      reviewRemark: this.reviewRemark,
      reviewedAt: this.reviewedAt,
      calculationDetails: this.calculationDetails,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

Reconciliation.RECON_STATUS = RECON_STATUS;
Reconciliation.DISCREPANCY_TYPES = DISCREPANCY_TYPES;

module.exports = Reconciliation;
