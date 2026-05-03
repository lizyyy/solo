const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const REVIEW_TYPES = {
  TEMPERATURE_CORRECTION: 'temperature_correction',
  SIGNATURE_SUPPLEMENT: 'signature_supplement',
  DELAY_EXPLANATION: 'delay_explanation',
  CHAIN_BREAK_RESOLUTION: 'chain_break_resolution',
  OTHER: 'other'
};

const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

class Review {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.riskEventId = options.riskEventId || null;
    this.batchId = options.batchId || null;
    this.boxId = options.boxId || null;
    this.type = options.type || REVIEW_TYPES.OTHER;
    this.status = options.status || REVIEW_STATUS.PENDING;
    this.reviewerId = options.reviewerId || null;
    this.reviewerName = options.reviewerName || '';
    this.submittedBy = options.submittedBy || null;
    this.submittedByName = options.submittedByName || '';
    this.title = options.title || '';
    this.description = options.description || '';
    this.evidence = options.evidence || [];
    this.correctionData = options.correctionData || {};
    this.reviewerNotes = options.reviewerNotes || '';
    this.submittedAt = options.submittedAt || moment().toISOString();
    this.reviewedAt = options.reviewedAt || null;
    this.createdAt = options.createdAt || moment().toISOString();
    this.updatedAt = options.updatedAt || moment().toISOString();
  }

  approve(reviewerNotes = '', reviewerId = null) {
    this.status = REVIEW_STATUS.APPROVED;
    this.reviewerNotes = reviewerNotes;
    if (reviewerId) {
      this.reviewerId = reviewerId;
    }
    this.reviewedAt = moment().toISOString();
    this.updatedAt = moment().toISOString();
    return this;
  }

  reject(reviewerNotes = '', reviewerId = null) {
    this.status = REVIEW_STATUS.REJECTED;
    this.reviewerNotes = reviewerNotes;
    if (reviewerId) {
      this.reviewerId = reviewerId;
    }
    this.reviewedAt = moment().toISOString();
    this.updatedAt = moment().toISOString();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      riskEventId: this.riskEventId,
      batchId: this.batchId,
      boxId: this.boxId,
      type: this.type,
      status: this.status,
      reviewerId: this.reviewerId,
      reviewerName: this.reviewerName,
      submittedBy: this.submittedBy,
      submittedByName: this.submittedByName,
      title: this.title,
      description: this.description,
      evidence: this.evidence,
      correctionData: this.correctionData,
      reviewerNotes: this.reviewerNotes,
      submittedAt: this.submittedAt,
      reviewedAt: this.reviewedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new Review(json);
  }
}

module.exports = Review;
module.exports.REVIEW_TYPES = REVIEW_TYPES;
module.exports.REVIEW_STATUS = REVIEW_STATUS;
