import { RefundReviewStatus, ReviewConclusion } from '../types';
export declare const StateTransitionRules: Record<RefundReviewStatus, RefundReviewStatus[]>;
export declare const ConclusionToStatusMap: Record<ReviewConclusion, RefundReviewStatus>;
export declare function isValidStatusTransition(currentStatus: RefundReviewStatus, targetStatus: RefundReviewStatus): boolean;
export declare function canBeReviewed(status: RefundReviewStatus): boolean;
export declare function isFinalStatus(status: RefundReviewStatus): boolean;
