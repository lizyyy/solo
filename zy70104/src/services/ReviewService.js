const Batch = require('../models/Batch');
const BatchService = require('./BatchService');
const dataStore = require('../utils/dataStore');
const { v4: uuidv4 } = require('uuid');

const REVIEW_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
};

class ReviewService {
  
  constructor() {
    this.batchService = new BatchService();
  }
  
  async submitReview(batchNo, allowRetry = false) {
    const batch = this.batchService.getBatchByNo(batchNo);
    if (!batch) {
      throw new Error(`未找到批次: ${batchNo}`);
    }
    
    if (!batch.canSubmitReview()) {
      throw new Error(`批次状态为 ${batch.status}，无法提交审核`);
    }
    
    if (batch.status !== Batch.STATUS.REVIEW_REJECTED) {
      const existingReviews = dataStore.getReviewsByBatch(batchNo);
      const pendingReview = existingReviews.find(
        r => r.status === REVIEW_STATUS.PENDING || r.status === REVIEW_STATUS.IN_PROGRESS
      );
      if (pendingReview) {
        throw new Error(`批次 ${batchNo} 已有正在进行的审核`);
      }
    }
    
    if (this._shouldSimulateTimeout(allowRetry)) {
      throw new Error('审核提交超时，请使用 --retry 重试');
    }
    
    const review = {
      id: uuidv4(),
      batchNo,
      batchSnapshot: this._createBatchSnapshot(batch),
      status: REVIEW_STATUS.PENDING,
      submitTime: new Date().toISOString(),
      reviewTime: null,
      reviewer: null,
      rejectReason: null,
      conflictMode: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    dataStore.saveReview(review);
    this.batchService.updateBatchStatus(batchNo, Batch.STATUS.PENDING_REVIEW);
    
    return review;
  }
  
  listReviews(status = null) {
    let reviews = dataStore.getReviews();
    if (status) {
      reviews = reviews.filter(r => r.status === status);
    }
    return reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
  getReviewById(id) {
    return dataStore.getReviewById(id);
  }
  
  approveReview(reviewId, conflictMode = 'merge') {
    const review = dataStore.getReviewById(reviewId);
    if (!review) {
      throw new Error(`未找到审核记录: ${reviewId}`);
    }
    
    if (review.status === REVIEW_STATUS.APPROVED) {
      return review;
    }
    
    if (review.status !== REVIEW_STATUS.PENDING) {
      throw new Error(`审核状态为 ${review.status}，无法通过`);
    }
    
    const batch = this.batchService.getBatchByNo(review.batchNo);
    if (!batch) {
      throw new Error(`批次已不存在: ${review.batchNo}`);
    }
    
    const conflict = this._checkForConflict(review, batch);
    if (conflict) {
      if (conflictMode === 'reject') {
        throw new Error(`数据冲突检测到，字段: ${conflict.field}`);
      }
      review.conflictResolved = {
        field: conflict.field,
        originalValue: conflict.originalValue,
        newValue: conflict.newValue,
        mode: conflictMode
      };
    }
    
    review.status = REVIEW_STATUS.APPROVED;
    review.reviewTime = new Date().toISOString();
    review.updatedAt = new Date().toISOString();
    review.conflictMode = conflictMode;
    
    dataStore.saveReview(review);
    this.batchService.updateBatchStatus(review.batchNo, Batch.STATUS.APPROVED);
    
    return review;
  }
  
  rejectReview(reviewId, reason) {
    const review = dataStore.getReviewById(reviewId);
    if (!review) {
      throw new Error(`未找到审核记录: ${reviewId}`);
    }
    
    if (review.status !== REVIEW_STATUS.PENDING) {
      throw new Error(`审核状态为 ${review.status}，无法拒绝`);
    }
    
    review.status = REVIEW_STATUS.REJECTED;
    review.rejectReason = reason;
    review.reviewTime = new Date().toISOString();
    review.updatedAt = new Date().toISOString();
    
    dataStore.saveReview(review);
    this.batchService.updateBatchStatus(review.batchNo, Batch.STATUS.REVIEW_REJECTED);
    
    return review;
  }
  
  cancelReview(reviewId) {
    const review = dataStore.getReviewById(reviewId);
    if (!review) {
      throw new Error(`未找到审核记录: ${reviewId}`);
    }
    
    if (review.status !== REVIEW_STATUS.PENDING && 
        review.status !== REVIEW_STATUS.IN_PROGRESS) {
      throw new Error(`审核状态为 ${review.status}，无法撤销`);
    }
    
    const batch = this.batchService.getBatchByNo(review.batchNo);
    if (batch && batch.status === Batch.STATUS.PENDING_REVIEW) {
      this.batchService.updateBatchStatus(review.batchNo, Batch.STATUS.DATA_COMPLETE);
    }
    
    review.status = REVIEW_STATUS.CANCELLED;
    review.updatedAt = new Date().toISOString();
    
    dataStore.saveReview(review);
    return review;
  }
  
  async retryReview(reviewId) {
    const review = dataStore.getReviewById(reviewId);
    if (!review) {
      throw new Error(`未找到审核记录: ${reviewId}`);
    }
    
    if (review.status !== REVIEW_STATUS.TIMEOUT) {
      throw new Error(`只有超时的审核才能重试`);
    }
    
    const config = dataStore.getConfig();
    if (review.retryCount >= config.retry.maxAttempts) {
      throw new Error(`重试次数已达上限 (${config.retry.maxAttempts})`);
    }
    
    review.retryCount += 1;
    review.status = REVIEW_STATUS.PENDING;
    review.updatedAt = new Date().toISOString();
    
    await this._delay(config.retry.backoffMs);
    
    dataStore.saveReview(review);
    return review;
  }
  
  _createBatchSnapshot(batch) {
    return {
      inWeight: batch.inWeight,
      inMoisture: batch.inMoisture,
      inTemp: batch.inTemp,
      outWeight: batch.outWeight,
      outMoisture: batch.outMoisture,
      outTemp: batch.outTemp,
      dryingTime: batch.dryingTime,
      fuelUsed: batch.fuelUsed,
      powerUsed: batch.powerUsed,
      version: batch.version
    };
  }
  
  _checkForConflict(review, currentBatch) {
    const snapshot = review.batchSnapshot;
    
    const conflictFields = ['outWeight', 'outMoisture', 'fuelUsed', 'powerUsed'];
    
    for (const field of conflictFields) {
      if (snapshot[field] !== undefined && 
          currentBatch[field] !== snapshot[field]) {
        return {
          field,
          originalValue: snapshot[field],
          newValue: currentBatch[field]
        };
      }
    }
    
    return null;
  }
  
  _shouldSimulateTimeout(allowRetry) {
    if (allowRetry) {
      return Math.random() > 0.7;
    }
    return false;
  }
  
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

ReviewService.STATUS = REVIEW_STATUS;

module.exports = ReviewService;
