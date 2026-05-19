const WorkRecord = require('../models/WorkRecord');
const Review = require('../models/Review');
const OperationLog = require('../models/OperationLog');
const { createBillingRecord } = require('./billingService');

const reviewRecord = async (workRecordId, reviewData, reviewer = 'system') => {
  const workRecord = await WorkRecord.findById(workRecordId);
  if (!workRecord) {
    throw new Error('作业记录不存在');
  }
  
  if (workRecord.status === 'approved') {
    throw new Error('该记录已审核通过，不能重复审核');
  }
  
  if (workRecord.status === 'rejected' && reviewData.reviewResult !== 'approved') {
    throw new Error('该记录已被驳回，如需修改请重新导入');
  }
  
  const { reviewResult, reviewComments } = reviewData;
  
  if (!['approved', 'rejected'].includes(reviewResult)) {
    throw new Error('无效的审核结果');
  }
  
  const review = await Review.create({
    workRecordId,
    reviewer,
    reviewResult,
    reviewComments
  });
  
  if (reviewResult === 'approved') {
    await WorkRecord.updateStatus(workRecordId, 'approved');
    
    const billingRecord = await createBillingRecord(workRecordId, {
      hours: workRecord.hours,
      acres: workRecord.acres,
      fuelConsumption: workRecord.fuelConsumption,
      remarks: reviewComments
    }, reviewer);
    
    await OperationLog.create({
      operation: 'approve_record',
      reviewer,
      targetType: 'work_record',
      targetId: workRecordId,
      details: { reviewId: review.id, billingId: billingRecord.id }
    });
    
    return {
      success: true,
      review,
      billing: billingRecord
    };
  } else {
    await WorkRecord.updateStatus(workRecordId, 'rejected');
    
    await OperationLog.create({
      operation: 'reject_record',
      reviewer,
      targetType: 'work_record',
      targetId: workRecordId,
      details: { reviewId: review.id, comments: reviewComments }
    });
    
    return {
      success: true,
      review
    };
  }
};

const batchReview = async (workRecordIds, reviewData, reviewer = 'system') => {
  const results = [];
  
  for (const id of workRecordIds) {
    try {
      const result = await reviewRecord(id, reviewData, reviewer);
      results.push({ id, success: true, ...result });
    } catch (error) {
      results.push({ id, success: false, error: error.message });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  
  await OperationLog.create({
    operation: 'batch_review',
    reviewer,
    targetType: 'work_record',
    details: { 
      total: workRecordIds.length,
      success: successCount,
      failed: failedCount,
      reviewResult: reviewData.reviewResult
    }
  });
  
  return {
    total: workRecordIds.length,
    success: successCount,
    failed: failedCount,
    results
  };
};

const getPendingRecords = async (filters = {}) => {
  return WorkRecord.findAll({ ...filters, status: 'pending' });
};

const getRecordReviews = async (workRecordId) => {
  return Review.findByWorkRecordId(workRecordId);
};

module.exports = {
  reviewRecord,
  batchReview,
  getPendingRecords,
  getRecordReviews
};
