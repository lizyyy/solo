const { readData, writeData } = require('../utils/storage');
const { generateId, getHazardById, getReviewsByHazard } = require('../utils/helpers');
const { HAZARD_STATUS, HAZARD_LEVEL, REVIEW_RESULT } = require('../utils/constants');
const { logAudit } = require('../utils/audit');
const { updateHazardStatus } = require('./hazardService');

function submitReview(hazardId, reviewData) {
  const hazard = getHazardById(hazardId);
  
  if (!hazard) {
    return { success: false, message: '隐患不存在' };
  }

  if (hazard.status === HAZARD_STATUS.CLOSED) {
    return { success: false, message: '隐患已闭环，不能复查' };
  }

  if (hazard.status !== HAZARD_STATUS.PENDING_REVIEW) {
    return { 
      success: false, 
      message: `只有待复查状态的隐患才能复查，当前状态: ${hazard.status}` 
    };
  }

  const reviews = readData('reviews');
  
  const existingReview = reviews.find(r => 
    r.hazardId === hazardId && 
    r.result === reviewData.result &&
    r.reviewer === reviewData.reviewer &&
    r.comment === reviewData.comment
  );

  if (existingReview) {
    return {
      success: true,
      isIdempotent: true,
      review: existingReview,
      message: '复查记录已存在（幂等操作）'
    };
  }

  const id = generateId();
  const now = new Date();

  const review = {
    id,
    hazardId,
    result: reviewData.result,
    reviewer: reviewData.reviewer || 'system',
    comment: reviewData.comment || '',
    images: reviewData.images || [],
    reviewDate: reviewData.reviewDate || now.toISOString(),
    createdAt: now.toISOString()
  };

  reviews.push(review);
  writeData('reviews', reviews);

  let statusResult;
  const reviewFailCount = getReviewsByHazard(hazardId).filter(r => r.result === REVIEW_RESULT.FAILED).length;

  if (review.result === REVIEW_RESULT.PASSED) {
    if (hazard.level === HAZARD_LEVEL.MAJOR || hazard.level === HAZARD_LEVEL.CRITICAL) {
      statusResult = updateHazardStatus(hazardId, HAZARD_STATUS.PENDING_REVIEW, {
        reviewFailCount
      });
    } else {
      statusResult = updateHazardStatus(hazardId, HAZARD_STATUS.CLOSED, {
        reviewFailCount
      });
    }
  } else {
    statusResult = updateHazardStatus(hazardId, HAZARD_STATUS.REOPENED, {
      reviewFailCount
    });
  }

  if (!statusResult.success) {
    return statusResult;
  }

  logAudit('review', 'hazard', hazardId, {
    reviewId: id,
    result: review.result,
    reviewer: review.reviewer,
    isReopened: review.result === REVIEW_RESULT.FAILED
  });

  return {
    success: true,
    review,
    hazard: statusResult.hazard,
    needsSecondReview: (review.result === REVIEW_RESULT.PASSED && 
      (hazard.level === HAZARD_LEVEL.MAJOR || hazard.level === HAZARD_LEVEL.CRITICAL))
  };
}

module.exports = {
  submitReview
};
