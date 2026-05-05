const db = require('./database');

function checkStatusJumps(candidateId, feedbacks, callback) {
  const issues = [];
  const validStatusFlow = ['初筛', '技术面', '复试', '终面', '通过', '待定', '拒绝'];
  
  const statusTransitions = {
    '初筛': ['技术面', '拒绝'],
    '技术面': ['复试', '拒绝', '待定'],
    '复试': ['终面', '拒绝', '待定'],
    '终面': ['通过', '拒绝', '待定'],
    '待定': ['通过', '拒绝', '待定'],
    '通过': [],
    '拒绝': []
  };

  const sortedFeedbacks = feedbacks.sort((a, b) => 
    new Date(a.interview_date || a.created_at) - new Date(b.interview_date || b.created_at)
  );

  for (let i = 1; i < sortedFeedbacks.length; i++) {
    const prevStatus = sortedFeedbacks[i-1].status;
    const currentStatus = sortedFeedbacks[i].status;
    
    if (prevStatus && currentStatus && prevStatus !== currentStatus) {
      const allowedTransitions = statusTransitions[prevStatus] || [];
      
      if (!allowedTransitions.includes(currentStatus)) {
        issues.push({
          id: `status-jump-${candidateId}-${i}`,
          type: 'status_jump',
          severity: 'high',
          candidateId: candidateId,
          description: `状态跳变异常: 从 "${prevStatus}" 直接跳转到 "${currentStatus}"`,
          details: {
            previousStatus: prevStatus,
            currentStatus: currentStatus,
            previousFeedback: sortedFeedbacks[i-1],
            currentFeedback: sortedFeedbacks[i]
          }
        });
      }
    }
  }

  callback(null, issues);
}

function checkRatingChangesWithoutAudit(candidateId, feedbacks, audits, callback) {
  const issues = [];
  
  const ratingFields = ['overall_rating', 'technical_rating', 'soft_skill_rating'];
  
  const feedbackMap = {};
  feedbacks.forEach(f => {
    const key = `${f.feedback_id}-${f.version}`;
    feedbackMap[key] = f;
  });

  const auditActions = audits.filter(a => 
    a.action_type === 'rating_change' || 
    (a.field_name && ratingFields.includes(a.field_name))
  );

  feedbacks.forEach(currentFeedback => {
    if (currentFeedback.version > 1) {
      const previousKey = `${currentFeedback.feedback_id}-${currentFeedback.version - 1}`;
      const previousFeedback = feedbackMap[previousKey];
      
      if (previousFeedback) {
        ratingFields.forEach(field => {
          const oldVal = previousFeedback[field];
          const newVal = currentFeedback[field];
          
          if (oldVal !== null && newVal !== null && oldVal !== newVal) {
            const hasAudit = auditActions.some(a => 
              a.field_name === field && 
              parseFloat(a.old_value) === oldVal && 
              parseFloat(a.new_value) === newVal
            );
            
            if (!hasAudit) {
              issues.push({
                id: `rating-no-audit-${candidateId}-${currentFeedback.feedback_id}-${field}`,
                type: 'rating_change_no_audit',
                severity: 'high',
                candidateId: candidateId,
                description: `评分修改无审计日志: ${currentFeedback.round_name || '未知轮次'} 的 ${getFieldName(field)} 从 ${oldVal} 改为 ${newVal}`,
                details: {
                  feedbackId: currentFeedback.feedback_id,
                  field: field,
                  fieldName: getFieldName(field),
                  oldValue: oldVal,
                  newValue: newVal,
                  roundName: currentFeedback.round_name,
                  interviewer: currentFeedback.interviewer_name,
                  version: currentFeedback.version
                }
              });
            }
          }
        });
      }
    }
  });

  callback(null, issues);
}

function checkReportInconsistency(candidateId, feedbacks, reportSnapshots, offerApprovals, callback) {
  const issues = [];
  
  const latestFeedback = feedbacks.length > 0 ? 
    feedbacks.reduce((latest, current) => {
      const latestDate = new Date(latest.interview_date || latest.created_at);
      const currentDate = new Date(current.interview_date || current.created_at);
      return currentDate > latestDate ? current : latest;
    }) : null;

  const latestReport = reportSnapshots.length > 0 ? 
    reportSnapshots.reduce((latest, current) => {
      const latestDate = new Date(latest.snapshot_date || latest.created_at);
      const currentDate = new Date(current.snapshot_date || current.created_at);
      return currentDate > latestDate ? current : latest;
    }) : null;

  const hasApproval = offerApprovals.length > 0;
  const approvalStatus = hasApproval ? 
    offerApprovals.reduce((latest, current) => {
      const latestDate = new Date(latest.approval_date || latest.created_at);
      const currentDate = new Date(current.approval_date || current.created_at);
      return currentDate > latestDate ? current : latest;
    }).approval_status : null;

  if (latestFeedback && latestReport) {
    const feedbackStatus = latestFeedback.status;
    const reportStatus = latestReport.final_status;
    
    if (feedbackStatus && reportStatus && feedbackStatus !== reportStatus) {
      issues.push({
        id: `report-inconsistent-${candidateId}`,
        type: 'report_inconsistency',
        severity: 'high',
        candidateId: candidateId,
        description: `报告结论与最新面试反馈不一致: 反馈显示 "${feedbackStatus}"，但报告结论为 "${reportStatus}"`,
        details: {
          feedbackStatus: feedbackStatus,
          reportStatus: reportStatus,
          latestFeedback: latestFeedback,
          latestReport: latestReport
        }
      });
    }

    const feedbackRating = latestFeedback.overall_rating;
    const reportRating = latestReport.final_rating;
    
    if (feedbackRating !== null && reportRating !== null && feedbackRating !== reportRating) {
      issues.push({
        id: `rating-inconsistent-${candidateId}`,
        type: 'rating_inconsistency',
        severity: 'medium',
        candidateId: candidateId,
        description: `评分不一致: 面试反馈评分 ${feedbackRating} 与报告评分 ${reportRating} 不一致`,
        details: {
          feedbackRating: feedbackRating,
          reportRating: reportRating,
          latestFeedback: latestFeedback,
          latestReport: latestReport
        }
      });
    }
  }

  if (latestFeedback && !hasApproval) {
    const status = latestFeedback.status;
    if (status === '通过' || status === '终面') {
      issues.push({
        id: `no-approval-${candidateId}`,
        type: 'missing_approval',
        severity: 'medium',
        candidateId: candidateId,
        description: `缺少审批记录: 面试状态为 "${status}"，但没有找到 Offer 审批记录`,
        details: {
          latestFeedback: latestFeedback,
          hasApproval: false
        }
      });
    }
  }

  if (hasApproval && approvalStatus) {
    const hasPassAudit = audits.some(a => 
      a.action === '审批' || 
      a.action_type === 'approval'
    );
    
    if (!hasPassAudit) {
      issues.push({
        id: `no-audit-for-approval-${candidateId}`,
        type: 'approval_without_audit',
        severity: 'high',
        candidateId: candidateId,
        description: `审批状态 "${approvalStatus}" 无对应审计日志`,
        details: {
          approvalStatus: approvalStatus,
          hasAudit: false
        }
      });
    }
  }

  callback(null, issues);
}

function getFieldName(field) {
  const names = {
    'overall_rating': '综合评分',
    'technical_rating': '技术评分',
    'soft_skill_rating': '软技能评分'
  };
  return names[field] || field;
}

function runAllRules(callback) {
  const allIssues = [];
  
  db.all(`SELECT DISTINCT candidate_id FROM candidates`, (err, candidates) => {
    if (err) return callback(err);
    
    if (candidates.length === 0) {
      return callback(null, []);
    }

    let processed = 0;
    const total = candidates.length;

    candidates.forEach(row => {
      const candidateId = row.candidate_id;
      
      db.all(`SELECT * FROM interview_feedback WHERE candidate_id = ? ORDER BY created_at`, [candidateId], (err, feedbacks) => {
        if (err) return callback(err);
        
        db.all(`SELECT * FROM audit_logs WHERE candidate_id = ? ORDER BY created_at`, [candidateId], (err, audits) => {
          if (err) return callback(err);
          
          db.all(`SELECT * FROM report_snapshots WHERE candidate_id = ? ORDER BY created_at`, [candidateId], (err, reports) => {
            if (err) return callback(err);
            
            db.all(`SELECT * FROM offer_approvals WHERE candidate_id = ? ORDER BY created_at`, [candidateId], (err, approvals) => {
              if (err) return callback(err);
              
              checkStatusJumps(candidateId, feedbacks, (err, statusIssues) => {
                if (err) return callback(err);
                allIssues.push(...statusIssues);
                
                checkRatingChangesWithoutAudit(candidateId, feedbacks, audits, (err, ratingIssues) => {
                  if (err) return callback(err);
                  allIssues.push(...ratingIssues);
                  
                  checkReportInconsistency(candidateId, feedbacks, reports, approvals, (err, reportIssues) => {
                    if (err) return callback(err);
                    allIssues.push(...reportIssues);
                    
                    processed++;
                    if (processed === total) {
                      callback(null, allIssues);
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

module.exports = {
  checkStatusJumps,
  checkRatingChangesWithoutAudit,
  checkReportInconsistency,
  runAllRules
};
