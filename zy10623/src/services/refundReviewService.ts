import { v4 as uuidv4 } from 'uuid';
import {
  RefundReview,
  RefundReviewStatus,
  ReviewConclusion,
  AuditLog,
  ReviewRequest,
  ManualRemarkRequest,
  PageResult,
  RiskTag,
  RefundReviewStatusLabel,
  RiskTagLabel,
  ReviewConclusionLabel,
  RefundReasonLabel
} from '../types';
import { dataStore } from '../store/dataStore';
import {
  isValidStatusTransition,
  ConclusionToStatusMap,
  canBeReviewed,
  isFinalStatus
} from '../utils/stateMachine';
import {
  createSuccessResponse,
  createBusinessErrorResponse,
  BusinessErrorCode,
  ApiResponse
} from '../utils/response';

class RefundReviewService {
  createRefundReview(params: {
    orderInfo: RefundReview['orderInfo'];
    refundReason: RefundReview['refundReason'];
    refundReasonDetail?: string;
    riskTags: RiskTag[];
    splitOrderGroupId?: string;
    idempotentKey: string;
  }): ApiResponse<RefundReview> {
    if (dataStore.checkIdempotentKey(params.idempotentKey)) {
      return createBusinessErrorResponse(BusinessErrorCode.IDEMPOTENT_CONFLICT);
    }

    const now = new Date().toISOString();
    const review: RefundReview = {
      id: uuidv4(),
      orderInfo: params.orderInfo,
      refundReason: params.refundReason,
      refundReasonDetail: params.refundReasonDetail,
      riskTags: params.riskTags,
      status: params.riskTags.length > 0 ? RefundReviewStatus.INTERCEPTING : RefundReviewStatus.PENDING_REFUND,
      splitOrderGroupId: params.splitOrderGroupId,
      createTime: now,
      updateTime: now,
      idempotentKey: params.idempotentKey
    };

    dataStore.addIdempotentKey(params.idempotentKey);
    const savedReview = dataStore.saveRefundReview(review);

    dataStore.saveAuditLog({
      refundReviewId: savedReview.id,
      action: 'CREATE',
      actionLabel: '创建复核记录',
      newStatus: savedReview.status,
      remark: `初始状态: ${RefundReviewStatusLabel[savedReview.status]}`,
      createTime: now
    });

    return createSuccessResponse(savedReview, '创建复核记录成功');
  }

  getRefundReview(id: string): ApiResponse<RefundReview> {
    const review = dataStore.getRefundReview(id);
    if (!review) {
      return createBusinessErrorResponse(BusinessErrorCode.RECORD_NOT_FOUND);
    }
    return createSuccessResponse(review, '查询成功');
  }

  listRefundReviews(
    page: number = 1,
    pageSize: number = 10,
    filters?: {
      status?: RefundReviewStatus;
      userId?: string;
      orderNo?: string;
    }
  ): ApiResponse<PageResult<RefundReview>> {
    const result = dataStore.listRefundReviews(page, pageSize, filters);
    return createSuccessResponse({
      list: result.list,
      total: result.total,
      page,
      pageSize
    }, '查询列表成功');
  }

  review(id: string, request: ReviewRequest): ApiResponse<RefundReview> {
    const review = dataStore.getRefundReview(id);
    if (!review) {
      return createBusinessErrorResponse(BusinessErrorCode.RECORD_NOT_FOUND);
    }

    if (!canBeReviewed(review.status)) {
      return createBusinessErrorResponse(
        BusinessErrorCode.ALREADY_REVIEWED,
        `当前状态为${RefundReviewStatusLabel[review.status]}，无法复核`
      );
    }

    if (review.riskTags.includes(RiskTag.SPLIT_ORDER_EVASION) && !review.manualRemark) {
      return createBusinessErrorResponse(BusinessErrorCode.SPLIT_ORDER_BLOCKED);
    }

    const targetStatus = ConclusionToStatusMap[request.reviewConclusion];
    if (!isValidStatusTransition(review.status, targetStatus)) {
      return createBusinessErrorResponse(
        BusinessErrorCode.INVALID_STATUS_TRANSITION,
        `无法从${RefundReviewStatusLabel[review.status]}流转到${RefundReviewStatusLabel[targetStatus]}`
      );
    }

    const now = new Date().toISOString();
    const oldStatus = review.status;

    review.status = targetStatus;
    review.reviewConclusion = request.reviewConclusion;
    review.reviewerId = request.operatorId;
    review.reviewerName = request.operatorName;
    review.reviewTime = now;
    review.reviewRemark = request.reviewRemark;

    const savedReview = dataStore.saveRefundReview(review);

    dataStore.saveAuditLog({
      refundReviewId: savedReview.id,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      action: 'REVIEW',
      actionLabel: '复核操作',
      oldStatus,
      newStatus: targetStatus,
      remark: `${ReviewConclusionLabel[request.reviewConclusion]}，备注: ${request.reviewRemark || '无'}`,
      createTime: now
    });

    return createSuccessResponse(savedReview, '复核成功');
  }

  addManualRemark(id: string, request: ManualRemarkRequest): ApiResponse<RefundReview> {
    const review = dataStore.getRefundReview(id);
    if (!review) {
      return createBusinessErrorResponse(BusinessErrorCode.RECORD_NOT_FOUND);
    }

    if (isFinalStatus(review.status)) {
      return createBusinessErrorResponse(
        BusinessErrorCode.ALREADY_REVIEWED,
        `当前状态为${RefundReviewStatusLabel[review.status]}，无法添加备注`
      );
    }

    const now = new Date().toISOString();
    review.manualRemark = request.manualRemark;
    review.manualRemarkOperatorId = request.operatorId;
    review.manualRemarkOperatorName = request.operatorName;
    review.manualRemarkTime = now;

    const savedReview = dataStore.saveRefundReview(review);

    dataStore.saveAuditLog({
      refundReviewId: savedReview.id,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      action: 'ADD_MANUAL_REMARK',
      actionLabel: '添加人工备注',
      oldStatus: review.status,
      newStatus: review.status,
      remark: `人工备注: ${request.manualRemark}`,
      createTime: now
    });

    return createSuccessResponse(savedReview, '添加备注成功，可继续推进复核流程');
  }

  getAuditLogs(id: string): ApiResponse<AuditLog[]> {
    const review = dataStore.getRefundReview(id);
    if (!review) {
      return createBusinessErrorResponse(BusinessErrorCode.RECORD_NOT_FOUND);
    }

    const logs = dataStore.listAuditLogs(id);
    return createSuccessResponse(logs, '查询审计日志成功');
  }

  getReviewDetailWithLabels(id: string): ApiResponse<any> {
    const review = dataStore.getRefundReview(id);
    if (!review) {
      return createBusinessErrorResponse(BusinessErrorCode.RECORD_NOT_FOUND);
    }

    return createSuccessResponse({
      ...review,
      statusLabel: RefundReviewStatusLabel[review.status],
      refundReasonLabel: RefundReasonLabel[review.refundReason],
      riskTagLabels: review.riskTags.map(tag => RiskTagLabel[tag]),
      reviewConclusionLabel: review.reviewConclusion ? ReviewConclusionLabel[review.reviewConclusion] : undefined
    }, '查询详情成功');
  }
}

export const refundReviewService = new RefundReviewService();
