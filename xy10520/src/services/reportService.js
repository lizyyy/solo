const { 
  getAllIssues, getIssueById,
  getCorrectionsByIssue, getReinspectionsByIssue,
  getStoreById, getInspectionById, getAllReinspections,
  getAllLogs, saveScores, getAllScores
} = require('../storage');
const { STATUS, readConfig } = require('../config');
const { formatDate, getCurrentMonth, isInCurrentMonth, isOverdue, daysBetween } = require('../utils');

function calculateStoreScore(storeId, month = getCurrentMonth()) {
  const config = readConfig();
  const issues = getAllIssues().filter(i => i.storeId === storeId);
  const reinspections = getAllReinspections();
  
  let totalIssues = 0;
  let closedIssues = 0;
  let overdueIssues = 0;
  let failedReinspections = 0;
  let baseScore = config.totalBaseScore;
  let deductions = [];
  
  for (const issue of issues) {
    if (!isInCurrentMonth(issue.createdAt)) continue;
    
    totalIssues++;
    
    if (issue.status === STATUS.CLOSED) {
      closedIssues++;
    }
    
    if (issue.status === STATUS.OVERDUE) {
      overdueIssues++;
      deductions.push({
        type: '逾期',
        issueId: issue.id,
        description: issue.description,
        points: config.overduePenaltyPoints
      });
      baseScore -= config.overduePenaltyPoints;
    }
    
    const issueReinspections = reinspections.filter(r => r.issueId === issue.id);
    for (const reinspection of issueReinspections) {
      if (!isInCurrentMonth(reinspection.reinspectedAt)) continue;
      if (reinspection.result === '不通过') {
        failedReinspections++;
        deductions.push({
          type: '复查不通过',
          issueId: issue.id,
          description: issue.description,
          points: config.reinspectionFailPenalty
        });
        baseScore -= config.reinspectionFailPenalty;
      }
    }
  }
  
  const closureRate = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 100;
  
  return {
    storeId,
    month,
    baseScore: config.totalBaseScore,
    finalScore: Math.max(0, baseScore),
    totalIssues,
    closedIssues,
    overdueIssues,
    failedReinspections,
    closureRate: `${closureRate}%`,
    deductions
  };
}

function generateOverallReport(month = getCurrentMonth()) {
  const allIssues = getAllIssues();
  const config = readConfig();
  
  const monthlyIssues = allIssues.filter(i => isInCurrentMonth(i.createdAt));
  
  const stats = {
    total: monthlyIssues.length,
    byStatus: {},
    byCategory: {},
    byStore: {}
  };
  
  for (const issue of monthlyIssues) {
    stats.byStatus[issue.status] = (stats.byStatus[issue.status] || 0) + 1;
    stats.byCategory[issue.category] = (stats.byCategory[issue.category] || 0) + 1;
    stats.byStore[issue.storeId] = (stats.byStore[issue.storeId] || 0) + 1;
  }
  
  const closed = stats.byStatus[STATUS.CLOSED] || 0;
  const pending = stats.byStatus[STATUS.PENDING] || 0;
  const submitted = stats.byStatus[STATUS.SUBMITTED] || 0;
  const overdue = stats.byStatus[STATUS.OVERDUE] || 0;
  const failed = stats.byStatus[STATUS.FAILED] || 0;
  
  const closedIssues = monthlyIssues.filter(i => i.status === STATUS.CLOSED);
  const pendingIssues = monthlyIssues.filter(i => 
    [STATUS.PENDING, STATUS.SUBMITTED, STATUS.FAILED, STATUS.OVERDUE].includes(i.status)
  );
  
  return {
    month,
    summary: {
      total: monthlyIssues.length,
      closed: closed,
      pending: pending + submitted + failed + overdue,
      overdue: overdue,
      closureRate: monthlyIssues.length > 0 
        ? Math.round((closed / monthlyIssues.length) * 100) 
        : 0
    },
    byStatus: stats.byStatus,
    byCategory: stats.byCategory,
    closedIssues: closedIssues.map(i => getIssueDetail(i.id)),
    pendingIssues: pendingIssues.map(i => getIssueDetail(i.id))
  };
}

function getIssueDetail(issueId) {
  const issue = getIssueById(issueId);
  if (!issue) return null;
  
  const store = getStoreById(issue.storeId);
  const inspection = getInspectionById(issue.inspectionId);
  const corrections = getCorrectionsByIssue(issueId);
  const reinspections = getReinspectionsByIssue(issueId);
  
  const config = readConfig();
  const isOverdueFlag = isOverdue(issue.dueDate);
  
  let deductionInfo = null;
  if (issue.status === STATUS.OVERDUE) {
    deductionInfo = {
      reason: '逾期未整改',
      points: config.overduePenaltyPoints
    };
  }
  
  const lastFailedReinspection = reinspections
    .filter(r => r.result === '不通过')
    .sort((a, b) => new Date(b.reinspectedAt) - new Date(a.reinspectedAt))[0];
  
  if (lastFailedReinspection) {
    deductionInfo = {
      reason: '复查不通过',
      points: lastFailedReinspection.penaltyPoints,
      inspector: lastFailedReinspection.inspector,
      comment: lastFailedReinspection.comment
    };
  }
  
  return {
    issue: {
      ...issue,
      storeName: store?.name || '未知门店',
      storeCode: store?.code || '',
      inspector: inspection?.inspector || '',
      inspectionDate: inspection?.inspectionDate || '',
      isOverdue: isOverdueFlag
    },
    corrections: corrections,
    reinspections: reinspections,
    deductionInfo,
    history: {
      created: issue.createdAt,
      corrections: corrections.map(c => ({
        submittedAt: c.submittedAt,
        submittedBy: c.submittedBy,
        photoCount: c.photoUrls.length
      })),
      reinspections: reinspections.map(r => ({
        reinspectedAt: r.reinspectedAt,
        inspector: r.inspector,
        result: r.result
      }))
    }
  };
}

function checkOverdueIssues() {
  const issues = getAllIssues();
  const now = new Date();
  const overdueList = [];
  
  for (const issue of issues) {
    if (issue.status === STATUS.CLOSED) continue;
    
    const dueDate = new Date(issue.dueDate);
    if (dueDate < now) {
      if (issue.status !== STATUS.OVERDUE) {
        overdueList.push({
          issueId: issue.id,
          issueDescription: issue.description,
          dueDate: issue.dueDate,
          daysOverdue: daysBetween(dueDate, now)
        });
      }
    }
  }
  
  return overdueList;
}

module.exports = {
  calculateStoreScore,
  generateOverallReport,
  getIssueDetail,
  checkOverdueIssues
};
