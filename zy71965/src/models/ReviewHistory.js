const { v4: uuidv4 } = require('uuid');

const REVIEW_ACTION = {
  STATUS_CHANGE: 'status_change',
  NOTE_ADD: 'note_add',
  DUPLICATE_MARK: 'duplicate_mark',
  CORRECTION: 'correction',
  MERGE: 'merge',
  EXPORT: 'export',
  IMPORT: 'import',
  COMMENT: 'comment'
};

class ReviewHistory {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.defectId = data.defectId || null;
    this.annotationId = data.annotationId || null;
    this.logId = data.logId || null;
    
    this.action = data.action || REVIEW_ACTION.COMMENT;
    this.actionDetail = data.actionDetail || data.details || {};
    
    this.reviewer = data.reviewer || data.author || null;
    this.timestamp = data.timestamp || new Date().toISOString();
    
    this.oldValue = data.oldValue !== undefined ? data.oldValue : null;
    this.newValue = data.newValue !== undefined ? data.newValue : null;
    
    this.comment = data.comment || data.note || '';
    
    this.sessionId = data.sessionId || null;
    this.batchId = data.batchId || null;
    
    this.relatedItems = data.relatedItems || [];
  }

  static createStatusChange(defectId, oldStatus, newStatus, reviewer = null, note = '') {
    return new ReviewHistory({
      defectId,
      action: REVIEW_ACTION.STATUS_CHANGE,
      actionDetail: { field: 'status' },
      reviewer,
      oldValue: oldStatus,
      newValue: newStatus,
      comment: note
    });
  }

  static createNote(defectId, noteContent, author = null) {
    return new ReviewHistory({
      defectId,
      action: REVIEW_ACTION.NOTE_ADD,
      reviewer: author,
      comment: noteContent
    });
  }

  static createCorrection(defectId, field, oldValue, newValue, reviewer = null, reason = '') {
    return new ReviewHistory({
      defectId,
      action: REVIEW_ACTION.CORRECTION,
      actionDetail: { field },
      reviewer,
      oldValue,
      newValue,
      comment: reason
    });
  }

  static createDuplicateMark(defectId, originalDefectId, reviewer = null, reason = '') {
    return new ReviewHistory({
      defectId,
      action: REVIEW_ACTION.DUPLICATE_MARK,
      actionDetail: { originalDefectId },
      reviewer,
      oldValue: false,
      newValue: true,
      comment: reason
    });
  }

  static createMerge(mergedIds, targetId, reviewer = null, reason = '') {
    return new ReviewHistory({
      defectId: targetId,
      action: REVIEW_ACTION.MERGE,
      actionDetail: { mergedIds, targetId },
      reviewer,
      relatedItems: mergedIds,
      comment: reason
    });
  }

  toJSON() {
    return {
      id: this.id,
      defectId: this.defectId,
      annotationId: this.annotationId,
      logId: this.logId,
      action: this.action,
      actionDetail: this.actionDetail,
      reviewer: this.reviewer,
      timestamp: this.timestamp,
      oldValue: this.oldValue,
      newValue: this.newValue,
      comment: this.comment,
      sessionId: this.sessionId,
      batchId: this.batchId,
      relatedItems: this.relatedItems
    };
  }
}

module.exports = { ReviewHistory, REVIEW_ACTION };
