const STATUS = {
  STATUS_IMPORTED: 'IMPORTED',
  STATUS_ENGINEER_REVIEWED: 'ENGINEER_REVIEWED',
  STATUS_FINALIZED: 'FINALIZED',
  NEED_QC_REVIEW: 'NEED_QC_REVIEW',
  QC_APPROVED: 'QC_APPROVED',
  QC_REJECTED: 'QC_REJECTED',
  SUPERSEDED: 'SUPERSEDED'
};

const STATUS_FLOW = {
  [STATUS.STATUS_IMPORTED]: [STATUS.STATUS_ENGINEER_REVIEWED, STATUS.NEED_QC_REVIEW],
  [STATUS.STATUS_ENGINEER_REVIEWED]: [STATUS.STATUS_FINALIZED, STATUS.NEED_QC_REVIEW],
  [STATUS.NEED_QC_REVIEW]: [STATUS.QC_APPROVED, STATUS.QC_REJECTED],
  [STATUS.QC_APPROVED]: [STATUS.STATUS_FINALIZED],
  [STATUS.QC_REJECTED]: [STATUS.STATUS_ENGINEER_REVIEWED, STATUS.SUPERSEDED],
  [STATUS.STATUS_FINALIZED]: [STATUS.SUPERSEDED]
};

const BOUNDARY_RULES = {
  MAX_SAMPLING_GAP_MINUTES: 30,
  MIN_SAMPLING_DURATION_RATIO: 0.5,
  THEORETICAL_SAMPLING_MINUTES: 60
};

function checkSamplingGap(record, previousRecord) {
  if (!previousRecord) return { hasIssue: false };
  
  const currentStartTime = new Date(record.sampling_start_time || record.sampling_time);
  const prevEndTime = new Date(previousRecord.sampling_end_time || previousRecord.sampling_time);
  const gapMinutes = (currentStartTime - prevEndTime) / (1000 * 60);
  
  if (gapMinutes > BOUNDARY_RULES.MAX_SAMPLING_GAP_MINUTES) {
    return {
      hasIssue: true,
      issueType: 'SAMPLING_GAP_EXCEEDED',
      gapMinutes: gapMinutes.toFixed(1),
      threshold: BOUNDARY_RULES.MAX_SAMPLING_GAP_MINUTES,
      message: `采样间隔 ${gapMinutes.toFixed(1)} 分钟，超过阈值 ${BOUNDARY_RULES.MAX_SAMPLING_GAP_MINUTES} 分钟`
    };
  }
  return { hasIssue: false };
}

function checkSamplingDuration(record) {
  if (!record.sampling_start_time || !record.sampling_end_time) {
    return { hasIssue: false };
  }
  
  const actualDuration = (new Date(record.sampling_end_time) - new Date(record.sampling_start_time)) / (1000 * 60);
  const minRequired = BOUNDARY_RULES.THEORETICAL_SAMPLING_MINUTES * BOUNDARY_RULES.MIN_SAMPLING_DURATION_RATIO;
  
  if (actualDuration < minRequired) {
    return {
      hasIssue: true,
      issueType: 'SAMPLING_DURATION_TOO_SHORT',
      actualDuration: actualDuration.toFixed(1),
      minRequired: minRequired.toFixed(1),
      message: `采样时长 ${actualDuration.toFixed(1)} 分钟，不足理论值的 ${BOUNDARY_RULES.MIN_SAMPLING_DURATION_RATIO * 100}%（需要 ${minRequired.toFixed(1)} 分钟）`
    };
  }
  return { hasIssue: false };
}

function runAllBoundaryChecks(record, previousRecord) {
  const issues = [];
  
  const gapCheck = checkSamplingGap(record, previousRecord);
  if (gapCheck.hasIssue) issues.push(gapCheck);
  
  const durationCheck = checkSamplingDuration(record);
  if (durationCheck.hasIssue) issues.push(durationCheck);
  
  return {
    hasIssues: issues.length > 0,
    issues: issues,
    autoStatus: issues.length > 0 ? STATUS.NEED_QC_REVIEW : null
  };
}

function canTransition(from, to) {
  const allowed = STATUS_FLOW[from] || [];
  return allowed.includes(to);
}

module.exports = {
  STATUS,
  STATUS_FLOW,
  BOUNDARY_RULES,
  checkSamplingGap,
  checkSamplingDuration,
  runAllBoundaryChecks,
  canTransition
};
