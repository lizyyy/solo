"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundReviewService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const dataStore_1 = require("../store/dataStore");
const stateMachine_1 = require("../utils/stateMachine");
const response_1 = require("../utils/response");
class RefundReviewService {
    createRefundReview(params) {
        if (dataStore_1.dataStore.checkIdempotentKey(params.idempotentKey)) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.IDEMPOTENT_CONFLICT);
        }
        const now = new Date().toISOString();
        const review = {
            id: (0, uuid_1.v4)(),
            orderInfo: params.orderInfo,
            refundReason: params.refundReason,
            refundReasonDetail: params.refundReasonDetail,
            riskTags: params.riskTags,
            status: params.riskTags.length > 0 ? types_1.RefundReviewStatus.INTERCEPTING : types_1.RefundReviewStatus.PENDING_REFUND,
            splitOrderGroupId: params.splitOrderGroupId,
            createTime: now,
            updateTime: now,
            idempotentKey: params.idempotentKey
        };
        dataStore_1.dataStore.addIdempotentKey(params.idempotentKey);
        const savedReview = dataStore_1.dataStore.saveRefundReview(review);
        dataStore_1.dataStore.saveAuditLog({
            refundReviewId: savedReview.id,
            action: 'CREATE',
            actionLabel: '创建复核记录',
            newStatus: savedReview.status,
            remark: `初始状态: ${types_1.RefundReviewStatusLabel[savedReview.status]}`,
            createTime: now
        });
        return (0, response_1.createSuccessResponse)(savedReview, '创建复核记录成功');
    }
    getRefundReview(id) {
        const review = dataStore_1.dataStore.getRefundReview(id);
        if (!review) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.RECORD_NOT_FOUND);
        }
        return (0, response_1.createSuccessResponse)(review, '查询成功');
    }
    listRefundReviews(page = 1, pageSize = 10, filters) {
        const result = dataStore_1.dataStore.listRefundReviews(page, pageSize, filters);
        return (0, response_1.createSuccessResponse)({
            list: result.list,
            total: result.total,
            page,
            pageSize
        }, '查询列表成功');
    }
    review(id, request) {
        const review = dataStore_1.dataStore.getRefundReview(id);
        if (!review) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.RECORD_NOT_FOUND);
        }
        if (!(0, stateMachine_1.canBeReviewed)(review.status)) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.ALREADY_REVIEWED, `当前状态为${types_1.RefundReviewStatusLabel[review.status]}，无法复核`);
        }
        if (review.riskTags.includes(types_1.RiskTag.SPLIT_ORDER_EVASION) && !review.manualRemark) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.SPLIT_ORDER_BLOCKED);
        }
        const targetStatus = stateMachine_1.ConclusionToStatusMap[request.reviewConclusion];
        if (!(0, stateMachine_1.isValidStatusTransition)(review.status, targetStatus)) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.INVALID_STATUS_TRANSITION, `无法从${types_1.RefundReviewStatusLabel[review.status]}流转到${types_1.RefundReviewStatusLabel[targetStatus]}`);
        }
        const now = new Date().toISOString();
        const oldStatus = review.status;
        review.status = targetStatus;
        review.reviewConclusion = request.reviewConclusion;
        review.reviewerId = request.operatorId;
        review.reviewerName = request.operatorName;
        review.reviewTime = now;
        review.reviewRemark = request.reviewRemark;
        const savedReview = dataStore_1.dataStore.saveRefundReview(review);
        dataStore_1.dataStore.saveAuditLog({
            refundReviewId: savedReview.id,
            operatorId: request.operatorId,
            operatorName: request.operatorName,
            action: 'REVIEW',
            actionLabel: '复核操作',
            oldStatus,
            newStatus: targetStatus,
            remark: `${types_1.ReviewConclusionLabel[request.reviewConclusion]}，备注: ${request.reviewRemark || '无'}`,
            createTime: now
        });
        return (0, response_1.createSuccessResponse)(savedReview, '复核成功');
    }
    addManualRemark(id, request) {
        const review = dataStore_1.dataStore.getRefundReview(id);
        if (!review) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.RECORD_NOT_FOUND);
        }
        if ((0, stateMachine_1.isFinalStatus)(review.status)) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.ALREADY_REVIEWED, `当前状态为${types_1.RefundReviewStatusLabel[review.status]}，无法添加备注`);
        }
        const now = new Date().toISOString();
        review.manualRemark = request.manualRemark;
        review.manualRemarkOperatorId = request.operatorId;
        review.manualRemarkOperatorName = request.operatorName;
        review.manualRemarkTime = now;
        const savedReview = dataStore_1.dataStore.saveRefundReview(review);
        dataStore_1.dataStore.saveAuditLog({
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
        return (0, response_1.createSuccessResponse)(savedReview, '添加备注成功，可继续推进复核流程');
    }
    getAuditLogs(id) {
        const review = dataStore_1.dataStore.getRefundReview(id);
        if (!review) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.RECORD_NOT_FOUND);
        }
        const logs = dataStore_1.dataStore.listAuditLogs(id);
        return (0, response_1.createSuccessResponse)(logs, '查询审计日志成功');
    }
    getReviewDetailWithLabels(id) {
        const review = dataStore_1.dataStore.getRefundReview(id);
        if (!review) {
            return (0, response_1.createBusinessErrorResponse)(response_1.BusinessErrorCode.RECORD_NOT_FOUND);
        }
        return (0, response_1.createSuccessResponse)({
            ...review,
            statusLabel: types_1.RefundReviewStatusLabel[review.status],
            refundReasonLabel: types_1.RefundReasonLabel[review.refundReason],
            riskTagLabels: review.riskTags.map(tag => types_1.RiskTagLabel[tag]),
            reviewConclusionLabel: review.reviewConclusion ? types_1.ReviewConclusionLabel[review.reviewConclusion] : undefined
        }, '查询详情成功');
    }
}
exports.refundReviewService = new RefundReviewService();
