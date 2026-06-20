import sys

filepath = '/Users/lzy/pro/solo/workspaces/zy72595/src/services/EvalService.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_catch = """      if (e.message === 'UNREVIEWED_BUCKET_DIFF') {
        const pendingDiffs = evalObj.checkBucketDiffsAfterReview();
        throw new FriendlyError('UNREVIEWED_BUCKET_DIFF', {
          pendingCount: pendingDiffs.length,
          pendingNoteIds: pendingDiffs.map(d => d.noteId),
          currentStep: evalObj.workflowStep,
          requestedStep: nextStep
        });
      }
      throw e;"""

new_catch = """      if (e.message === 'UNREVIEWED_BUCKET_DIFF') {
        const pendingDiffs = evalObj.checkBucketDiffsAfterReview();
        throw new FriendlyError('UNREVIEWED_BUCKET_DIFF', {
          pendingCount: pendingDiffs.length,
          pendingNoteIds: pendingDiffs.map(d => d.noteId),
          currentStep: evalObj.workflowStep,
          requestedStep: nextStep
        });
      }
      if (e.message === 'ABNORMAL_REVIEW_BLOCKED') {
        const abnormalNoteIds = evalObj.getAbnormalReviewedNoteIds();
        throw new FriendlyError('ABNORMAL_REVIEW_BLOCKED', {
          abnormalNoteIds,
          abnormalCount: abnormalNoteIds.length,
          currentStep: evalObj.workflowStep,
          requestedStep: nextStep
        });
      }
      throw e;"""

if old_catch not in content:
    print('ERROR: Could not find old_catch pattern', file=sys.stderr)
    sys.exit(1)

content = content.replace(old_catch, new_catch)

old_return = """    return {
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
    };"""

new_return = """    const result = {
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

    if (decision === 'abnormal') {
      result.autoRollback = true;
      result.rollbackRecord = evalObj.rollbackHistory[evalObj.rollbackHistory.length - 1];
      result.status = evalObj.status;
      result.workflowStep = evalObj.workflowStep;
    } else {
      result.autoRollback = false;
    }

    return result;"""

if old_return not in content:
    print('ERROR: Could not find old_return pattern', file=sys.stderr)
    sys.exit(1)

content = content.replace(old_return, new_return)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('EvalService.js updated successfully')
