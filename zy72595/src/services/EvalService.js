const ThresholdNote = require('../models/ThresholdNote');
const FewShotEval = require('../models/FewShotEval');
const OnlineExperimentBucket = require('../models/OnlineExperimentBucket');
const { WORKFLOW_STEP, EVAL_STATUS, BUCKET_NAMES } = require('../models/types');
const { FriendlyError, wrapError } = require('../utils/errors');
const { checkBoundaryRules } = require('../boundaryRules');

class EvalService {
  constructor() {
    this.evals = new Map();
    this.thresholdNotes = new Map();
    this.onlineBuckets = new Map();
  }

  createEval(name, createdBy) {
    const evalObj = new FewShotEval({
      name,
      createdBy,
      status: EVAL_STATUS.PENDING_REVIEW
    });
    this.evals.set(evalObj.id, evalObj);
    return evalObj;
  }

  getEval(evalId) {
    const evalObj = this.evals.get(evalId);
    if (!evalObj) {
      throw new FriendlyError('EVAL_NOT_FOUND', { evalId });
    }
    return evalObj;
  }

  importThresholdBatch(evalId, batchId, notesData, operator) {
    if (!batchId || batchId.trim() === '') {
      throw new FriendlyError('EMPTY_BATCH_ID');
    }
    
    const evalObj = this.getEval(evalId);
    
    if (evalObj.hasBatchImported(batchId)) {
      throw new FriendlyError('BATCH_ALREADY_IMPORTED', { batchId, evalId });
    }

    const importedNotes = [];
    for (const noteData of notesData) {
      const note = new ThresholdNote({
        ...noteData,
        batchId,
        updatedBy: operator
      });
      
      if (!BUCKET_NAMES.includes(note.offlineBucket) || !BUCKET_NAMES.includes(note.onlineBucket)) {
        throw new FriendlyError('INVALID_BUCKET_NAME', {
          offlineBucket: note.offlineBucket,
          onlineBucket: note.onlineBucket
        });
      }
      
      this.thresholdNotes.set(note.id, note);
      evalObj.addThresholdNote(note.id, batchId);
      importedNotes.push(note);
    }

    return {
      eval: evalObj,
      importedNotes,
      count: importedNotes.length,
      batchId
    };
  }

  updateNoteRemark(noteId, newRemark, operator) {
    const note = this.thresholdNotes.get(noteId);
    if (!note) {
      throw new FriendlyError('NOTE_NOT_FOUND', { noteId });
    }
    
    if (note.remark === newRemark) {
      throw new FriendlyError('REMARK_SAME_AS_BEFORE', { noteId });
    }
    
    note.updateRemark(newRemark, operator);
    return {
      noteId: note.id,
      oldRemark: note.versions[note.versions.length - 2]?.remark,
      newRemark: note.remark,
      version: note.versions.length,
      history: note.getChangeHistory()
    };
  }

  getNoteHistory(noteId) {
    const note = this.thresholdNotes.get(noteId);
    if (!note) {
      throw new FriendlyError('NOTE_NOT_FOUND', { noteId });
    }
    return {
      noteId: note.id,
      history: note.getChangeHistory()
    };
  }

  advanceWorkflow(evalId, nextStep, reviewer) {
    const evalObj = this.getEval(evalId);
    const allNotes = Array.from(this.thresholdNotes.values());
    
    try {
      evalObj.advanceWorkflow(nextStep, reviewer, allNotes);
    } catch (e) {
      if (e.message === 'INVALID_WORKFLOW_ORDER') {
        throw new FriendlyError('INVALID_WORKFLOW_ORDER', {
          currentStep: evalObj.workflowStep,
          requestedStep: nextStep
        });
      }
      if (e.message === 'UNREVIEWED_BUCKET_DIFF') {
        const pendingDiffs = evalObj.checkBucketDiffsAfterReview();
        throw new FriendlyError('UNREVIEWED_BUCKET_DIFF', {
          pendingCount: pendingDiffs.length,
          pendingNoteIds: pendingDiffs.map(d => d.noteId),
          currentStep: evalObj.workflowStep,
          requestedStep: nextStep
        });
      }
      throw e;
    }
    
    const diffs = evalObj.checkBucketDiffs(allNotes);
    const needsReview = diffs.length > 0;
    
    return {
      eval: evalObj,
      bucketDiffs: diffs,
      needsReview,
      message: needsReview 
        ? `发现 ${diffs.length} 条记录离线和线上分数差了一个桶，需要评测运营复核`
        : '工作流推进成功'
    };
  }

  reviewBucketDiff(evalId, noteId, reviewer, decision, comment) {
    const evalObj = this.getEval(evalId);
    const note = this.thresholdNotes.get(noteId);
    if (!note) {
      throw new FriendlyError('NOTE_NOT_FOUND', { noteId });
    }
    
    evalObj.approveBucketDiff(noteId, reviewer, decision, comment);
    
    const pendingDiffs = evalObj.checkBucketDiffsAfterReview();
    
    return {
      eval: evalObj,
      reviewedNote: {
        noteId,
        decision,
        comment,
        offlineBucket: note.offlineBucket,
        onlineBucket: note.onlineBucket
      },
      remainingPendingDiffs: pendingDiffs,
      allReviewed: pendingDiffs.length === 0
    };
  }

  rollbackWorkflow(evalId, toStep, operator, reason) {
    const evalObj = this.getEval(evalId);
    
    const validSteps = Object.values(WORKFLOW_STEP);
    if (!validSteps.includes(toStep)) {
      throw new FriendlyError('ROLLBACK_STEP_INVALID', { requestedStep: toStep });
    }
    
    evalObj.rollback(toStep, operator, reason);
    
    return {
      eval: evalObj,
      rollbackRecord: evalObj.rollbackHistory[evalObj.rollbackHistory.length - 1]
    };
  }

  setDisplayMode(evalId, mode) {
    const evalObj = this.getEval(evalId);
    try {
      evalObj.setDisplayMode(mode);
    } catch (e) {
      if (e.message === 'INVALID_DISPLAY_MODE') {
        throw new FriendlyError('INVALID_DISPLAY_MODE', { requestedMode: mode });
      }
      throw e;
    }
    return evalObj;
  }

  clickOnChartNote(evalId, noteId) {
    const evalObj = this.getEval(evalId);
    const allNotes = Array.from(this.thresholdNotes.values());
    
    const noteDetail = evalObj.getClickableNote(noteId, allNotes);
    if (!noteDetail) {
      throw new FriendlyError('NOTE_NOT_FOUND', { noteId, evalId });
    }
    
    const boundaryRules = checkBoundaryRules(this.thresholdNotes.get(noteId));
    
    return {
      note: noteDetail,
      boundaryRules,
      linkedBucket: this.findLinkedBucket(noteId)
    };
  }

  findLinkedBucket(noteId) {
    const note = this.thresholdNotes.get(noteId);
    if (!note) return null;
    for (const bucket of this.onlineBuckets.values()) {
      if (bucket.bucketName === note.onlineBucket) {
        return {
          bucketId: bucket.id,
          experimentId: bucket.experimentId,
          bucketName: bucket.bucketName,
          metrics: bucket.metrics
        };
      }
    }
    return null;
  }

  addOnlineBucket(bucketData) {
    const bucket = new OnlineExperimentBucket(bucketData);
    if (!bucket.isValidBucket()) {
      throw new FriendlyError('INVALID_BUCKET_NAME', { bucketName: bucket.bucketName });
    }
    this.onlineBuckets.set(bucket.id, bucket);
    return bucket;
  }

  getEvalDetails(evalId) {
    const evalObj = this.getEval(evalId);
    const notes = evalObj.thresholdNoteIds
      .map(id => this.thresholdNotes.get(id))
      .filter(Boolean);
    
    const notesWithRules = notes.map(note => ({
      ...note,
      boundaryRules: checkBoundaryRules(note)
    }));
    
    return {
      eval: evalObj,
      notes: notesWithRules,
      pendingReviews: evalObj.checkBucketDiffsAfterReview(),
      rollbackHistory: evalObj.rollbackHistory
    };
  }
}

module.exports = EvalService;
