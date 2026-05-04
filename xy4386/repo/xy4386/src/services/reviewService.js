const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const store = require('../data/store');
const riskService = require('./riskService');
const { validateReview } = require('../utils/validator');

const REVIEW_DECISIONS = {
  CONFIRM: 'confirm',
  DISMISS: 'dismiss',
  ESCALATE: 'escalate'
};

class ReviewService {
  constructor() {
    this.reviewDecisions = REVIEW_DECISIONS;
  }

  createReview(riskId, reviewerId, reviewerName, decision, comments) {
    return {
      reviewId: uuidv4(),
      riskId,
      reviewerId,
      reviewerName,
      decision,
      comments,
      timestamp: dayjs().toISOString()
    };
  }

  async reviewRisk(riskId, reviewerId, reviewerName, decision, comments) {
    const risk = riskService.getRiskById(riskId);
    if (!risk) {
      return {
        success: false,
        error: `风险记录不存在: ${riskId}`
      };
    }

    if (!Object.values(REVIEW_DECISIONS).includes(decision)) {
      return {
        success: false,
        error: `无效的复核决定。有效值: ${Object.values(REVIEW_DECISIONS).join(', ')}`
      };
    }

    if (!comments || comments.trim().length === 0) {
      return {
        success: false,
        error: '复核意见不能为空'
      };
    }

    const review = this.createReview(riskId, reviewerId, reviewerName, decision, comments);
    
    const validation = validateReview(review);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    store.saveReview(review.reviewId, review);

    const allRisks = store.getAllRisks();
    const riskIndex = allRisks.findIndex(r => r.riskId === riskId);
    if (riskIndex >= 0) {
      allRisks[riskIndex] = {
        ...allRisks[riskIndex],
        status: 'reviewed',
        reviewedAt: review.timestamp,
        reviewDecision: decision,
        reviewComments: comments,
        reviewerId,
        reviewerName
      };
      store.saveRisks(allRisks);
    }

    return {
      success: true,
      reviewId: review.reviewId,
      riskId,
      decision,
      message: `风险 [${riskId}] 复核完成，决定: ${decision}`
    };
  }

  getReviewById(reviewId) {
    return store.getReview(reviewId);
  }

  getReviewsByRiskId(riskId) {
    return store.getReviewsByRiskId(riskId);
  }

  getAllReviews() {
    return store.getAllReviews();
  }

  getReviewsByDecision(decision) {
    return Object.values(store.getAllReviews()).filter(r => r.decision === decision);
  }

  getRiskReviewSummary() {
    const allRisks = store.getAllRisks();
    const allReviews = store.getAllReviews();

    const summary = {
      total: allRisks.length,
      pending: 0,
      reviewed: 0,
      byDecision: {
        confirm: 0,
        dismiss: 0,
        escalate: 0
      },
      recentReviews: []
    };

    allRisks.forEach(risk => {
      if (risk.status === 'pending') {
        summary.pending++;
      } else if (risk.status === 'reviewed') {
        summary.reviewed++;
        if (risk.reviewDecision) {
          summary.byDecision[risk.reviewDecision]++;
        }
      }
    });

    const sortedReviews = [...allReviews].sort((a, b) => 
      dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf()
    );
    summary.recentReviews = sortedReviews.slice(0, 10);

    return summary;
  }
}

module.exports = new ReviewService();
