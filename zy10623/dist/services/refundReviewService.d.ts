import { RefundReview, RefundReviewStatus, AuditLog, ReviewRequest, ManualRemarkRequest, PageResult, RiskTag } from '../types';
import { ApiResponse } from '../utils/response';
declare class RefundReviewService {
    createRefundReview(params: {
        orderInfo: RefundReview['orderInfo'];
        refundReason: RefundReview['refundReason'];
        refundReasonDetail?: string;
        riskTags: RiskTag[];
        splitOrderGroupId?: string;
        idempotentKey: string;
    }): ApiResponse<RefundReview>;
    getRefundReview(id: string): ApiResponse<RefundReview>;
    listRefundReviews(page?: number, pageSize?: number, filters?: {
        status?: RefundReviewStatus;
        userId?: string;
        orderNo?: string;
    }): ApiResponse<PageResult<RefundReview>>;
    review(id: string, request: ReviewRequest): ApiResponse<RefundReview>;
    addManualRemark(id: string, request: ManualRemarkRequest): ApiResponse<RefundReview>;
    getAuditLogs(id: string): ApiResponse<AuditLog[]>;
    getReviewDetailWithLabels(id: string): ApiResponse<any>;
}
export declare const refundReviewService: RefundReviewService;
export {};
