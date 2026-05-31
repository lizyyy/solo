const { v4: uuidv4 } = require('uuid');

const DEFECT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review',
  FIXED: 'fixed',
  DUPLICATE: 'duplicate'
};

const DEFECT_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown'
};

class Defect {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.imageId = data.imageId || data.image_path || null;
    this.imagePath = data.imagePath || data.image_path || null;
    this.defectType = data.defectType || data.defect_type || data.type || 'unknown';
    this.coordinates = data.coordinates || data.bbox || [];
    this.confidence = data.confidence !== undefined ? data.confidence : null;
    this.severity = data.severity || DEFECT_SEVERITY.UNKNOWN;
    this.status = data.status || DEFECT_STATUS.PENDING;
    
    this.source = data.source || 'manual';
    this.sourceLogId = data.sourceLogId || null;
    this.sourceAnnotationId = data.sourceAnnotationId || null;
    
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    this.assignedTo = data.assignedTo || null;
    this.tags = data.tags || [];
    this.notes = data.notes || [];
    this.reviewCount = data.reviewCount || 0;
    this.lastReviewer = data.lastReviewer || null;
    this.lastReviewedAt = data.lastReviewedAt || null;
    
    this.isDuplicate = data.isDuplicate || false;
    this.duplicateOf = data.duplicateOf || null;
    this.relatedDefects = data.relatedDefects || [];
    
    this.groundTruth = data.groundTruth || null;
    this.prediction = data.prediction || null;
    this.iou = data.iou !== undefined ? data.iou : null;
    this.evaluationResult = data.evaluationResult || null;
  }

  updateStatus(status, reviewer = null, note = '') {
    const oldStatus = this.status;
    this.status = status;
    this.updatedAt = new Date().toISOString();
    this.reviewCount++;
    if (reviewer) {
      this.lastReviewer = reviewer;
      this.lastReviewedAt = this.updatedAt;
    }
    
    return {
      defectId: this.id,
      oldStatus,
      newStatus: status,
      reviewer,
      note,
      timestamp: this.updatedAt
    };
  }

  addNote(content, author = null) {
    const note = {
      id: uuidv4(),
      content,
      author,
      createdAt: new Date().toISOString()
    };
    this.notes.push(note);
    this.updatedAt = note.createdAt;
    return note;
  }

  markAsDuplicate(originalDefectId) {
    this.isDuplicate = true;
    this.duplicateOf = originalDefectId;
    this.status = DEFECT_STATUS.DUPLICATE;
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      imageId: this.imageId,
      imagePath: this.imagePath,
      defectType: this.defectType,
      coordinates: this.coordinates,
      confidence: this.confidence,
      severity: this.severity,
      status: this.status,
      source: this.source,
      sourceLogId: this.sourceLogId,
      sourceAnnotationId: this.sourceAnnotationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      assignedTo: this.assignedTo,
      tags: this.tags,
      notes: this.notes,
      reviewCount: this.reviewCount,
      lastReviewer: this.lastReviewer,
      lastReviewedAt: this.lastReviewedAt,
      isDuplicate: this.isDuplicate,
      duplicateOf: this.duplicateOf,
      relatedDefects: this.relatedDefects,
      groundTruth: this.groundTruth,
      prediction: this.prediction,
      iou: this.iou,
      evaluationResult: this.evaluationResult
    };
  }
}

module.exports = { Defect, DEFECT_STATUS, DEFECT_SEVERITY };
