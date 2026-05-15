"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addReviewOpinion = addReviewOpinion;
exports.getReviewSummary = getReviewSummary;
exports.traceToOriginalRecord = traceToOriginalRecord;
exports.applyReviewToStatus = applyReviewToStatus;
function addReviewOpinion(result, reviewer, reviewerId, opinion, comments) {
    const reviewOpinion = {
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
function getReviewSummary(result) {
    const opinions = result.reviewOpinions;
    const agreeCount = opinions.filter(o => o.opinion === 'agree').length;
    const disagreeCount = opinions.filter(o => o.opinion === 'disagree').length;
    const needMoreInfoCount = opinions.filter(o => o.opinion === 'need_more_info').length;
    let finalRecommendation;
    if (needMoreInfoCount > 0) {
        finalRecommendation = 'further_review';
    }
    else if (agreeCount > disagreeCount) {
        finalRecommendation = 'approve';
    }
    else if (disagreeCount > agreeCount) {
        finalRecommendation = 'reject';
    }
    else {
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
function traceToOriginalRecord(result, reviewOpinionId) {
    const opinion = result.reviewOpinions.find(o => o.id === reviewOpinionId);
    if (!opinion)
        return null;
    const parts = opinion.originalRecordReference.split(':');
    if (parts[0] === 'submission') {
        return `原始记录位置: 提交记录 ${parts[1]} 的审核追踪 (auditTrail)`;
    }
    return opinion.originalRecordReference;
}
function applyReviewToStatus(result) {
    const summary = getReviewSummary(result);
    let newStatus = result.afterStatus;
    if (summary.finalRecommendation === 'approve' && result.isIntercepted) {
        newStatus = 'approved';
    }
    else if (summary.finalRecommendation === 'reject' && !result.isIntercepted) {
        newStatus = 'intercepted';
    }
    return {
        ...result,
        afterStatus: newStatus
    };
}
