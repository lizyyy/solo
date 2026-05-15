import { AuditResult, ReviewOpinion } from './types';

export function addReviewOpinion(
  result: AuditResult,
  reviewer: string,
  reviewerId: string,
  opinion: 'agree' | 'disagree' | 'need_more_info',
  comments: string
): AuditResult {
  const reviewOpinion: ReviewOpinion = {
    id: `REV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    reviewer,
    reviewerId,
    timestamp: new Date().toISOString(),
    opinion,
    comments,
    originalRecordReference: `submission:${result.submissionId}:auditTrail`
  };
  
  return {
    ...result,
    reviewOpinions: [...result.reviewOpinions, reviewOpinion]
  };
}

export function getReviewSummary(result: AuditResult): {
  totalOpinions: number;
  agreeCount: number;
  disagreeCount: number;
  needMoreInfoCount: number;
  finalRecommendation: 'approve' | 'reject' | 'further_review';
} {
  const opinions = result.reviewOpinions;
  const agreeCount = opinions.filter(o => o.opinion === 'agree').length;
  const disagreeCount = opinions.filter(o => o.opinion === 'disagree').length;
  const needMoreInfoCount = opinions.filter(o => o.opinion === 'need_more_info').length;
  
  let finalRecommendation: 'approve' | 'reject' | 'further_review';
  if (needMoreInfoCount > 0) {
    finalRecommendation = 'further_review';
  } else if (agreeCount > disagreeCount) {
    finalRecommendation = 'approve';
  } else if (disagreeCount > agreeCount) {
    finalRecommendation = 'reject';
  } else {
    finalRecommendation = 'further_review';
  }
  
  return {
    totalOpinions: opinions.length,
    agreeCount,
    disagreeCount,
    needMoreInfoCount,
    finalRecommendation
  };
}

export function traceToOriginalRecord(result: AuditResult, reviewOpinionId: string): string | null {
  const opinion = result.reviewOpinions.find(o => o.id === reviewOpinionId);
  if (!opinion) return null;
  
  const parts = opinion.originalRecordReference.split(':');
  if (parts[0] === 'submission') {
    return `原始记录位置: 提交记录 ${parts[1]} 的审核追踪 (auditTrail)`;
  }
  return opinion.originalRecordReference;
}

export function applyReviewToStatus(result: AuditResult): AuditResult {
  const summary = getReviewSummary(result);
  let newStatus = result.afterStatus;
  
  if (summary.finalRecommendation === 'approve' && result.isIntercepted) {
    newStatus = 'approved';
  } else if (summary.finalRecommendation === 'reject' && !result.isIntercepted) {
    newStatus = 'intercepted';
  }
  
  return {
    ...result,
    afterStatus: newStatus
  };
}
