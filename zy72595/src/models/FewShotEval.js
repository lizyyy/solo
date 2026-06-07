const { generateId, EVAL_STATUS, WORKFLOW_STEP, DISPLAY_MODE, getBucketIndex, getBucketName } = require('./types');

class FewShotEval {
  constructor(data) {
    this.id = data.id || generateId();
    this.name = data.name;
    this.thresholdNoteIds = data.thresholdNoteIds || [];
    this.status = data.status || EVAL_STATUS.PENDING_REVIEW;
    this.workflowStep = data.workflowStep || WORKFLOW_STEP.IMPORTED;
    this.displayMode = data.displayMode || DISPLAY_MODE.TABLE;
    this.reviewComments = data.reviewComments || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy || '';
    this.rollbackHistory = data.rollbackHistory || [];
    this.sampleCount = data.sampleCount || 0;
    this.importBatchIds = data.importBatchIds || [];
  }

  addThresholdNote(noteId, batchId) {
    if (!this.thresholdNoteIds.includes(noteId)) {
      this.thresholdNoteIds.push(noteId);
      this.sampleCount = this.thresholdNoteIds.length;
    }
    if (batchId && !this.importBatchIds.includes(batchId)) {
      this.importBatchIds.push(batchId);
    }
    this.updatedAt = new Date().toISOString();
    return this;
  }

  hasBatchImported(batchId) {
    return this.importBatchIds.includes(batchId);
  }

  checkBucketDiffs(thresholdNotes) {
    const results = [];
    for (const noteId of this.thresholdNoteIds) {
      const note = thresholdNotes.find(n => n.id === noteId);
      if (note && note.isOneBucketDiff()) {
        results.push({
          noteId: note.id,
          offlineBucket: note.offlineBucket,
          onlineBucket: note.onlineBucket,
          diff: note.getBucketDiff(),
          needsReview: true
        });
      }
    }
    return results;
  }

  advanceWorkflow(nextStep, reviewer, thresholdNotes) {
    if (nextStep === WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED) {
      if (this.workflowStep !== WORKFLOW_STEP.IMPORTED) {
        throw new Error('INVALID_WORKFLOW_ORDER');
      }
      const diffs = this.checkBucketDiffs(thresholdNotes);
      if (diffs.length > 0) {
        this.status = EVAL_STATUS.NEEDS_RECHECK;
        this.reviewComments.push({
          timestamp: new Date().toISOString(),
          reviewer,
          comment: `发现 ${diffs.length} 条记录存在离线和线上分数差一个桶，需要评测运营复核`,
          diffDetails: diffs
        });
      }
    } else if (nextStep === WORKFLOW_STEP.COMPARISON_UPDATED) {
      if (this.workflowStep !== WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED) {
        throw new Error('INVALID_WORKFLOW_ORDER');
      }
    }
    this.workflowStep = nextStep;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  approveBucketDiff(noteId, reviewer, decision, comment) {
    const idx = this.reviewComments.find(c => c.diffDetails && c.diffDetails.some(d => d.noteId === noteId));
    if (idx) {
      this.reviewComments.push({
        timestamp: new Date().toISOString(),
        reviewer,
        comment,
        decision,
        noteId
      });
      const pendingDiffs = this.checkBucketDiffsAfterReview();
      if (pendingDiffs.length === 0 && this.status === EVAL_STATUS.NEEDS_RECHECK) {
        this.status = EVAL_STATUS.NORMAL;
      }
    }
    this.updatedAt = new Date().toISOString();
    return this;
  }

  checkBucketDiffsAfterReview() {
    const reviewedNoteIds = this.reviewComments
      .filter(c => c.decision && c.noteId)
      .map(c => c.noteId);
    return this.reviewComments
      .flatMap(c => c.diffDetails || [])
      .filter(d => !reviewedNoteIds.includes(d.noteId));
  }

  rollback(toStep, operator, reason) {
    this.rollbackHistory.push({
      fromStep: this.workflowStep,
      toStep,
      timestamp: new Date().toISOString(),
      operator,
      reason
    });
    this.workflowStep = toStep;
    this.status = EVAL_STATUS.ROLLBACK;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  setDisplayMode(mode) {
    if (!Object.values(DISPLAY_MODE).includes(mode)) {
      throw new Error('INVALID_DISPLAY_MODE');
    }
    this.displayMode = mode;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  getClickableNote(noteId, thresholdNotes) {
    const note = thresholdNotes.find(n => n.id === noteId);
    if (!note) return null;
    return {
      noteId: note.id,
      batchId: note.batchId,
      offlineBucket: note.offlineBucket,
      onlineBucket: note.onlineBucket,
      offlineScore: note.offlineScore,
      onlineScore: note.onlineScore,
      remark: note.remark,
      versions: note.getChangeHistory()
    };
  }
}

module.exports = FewShotEval;
