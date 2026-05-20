import { DiffDetail } from '../types';
export declare class ReviewService {
    reviewDiff(resultId: string, diffId: string, reviewer: string, action: 'confirm' | 'resolve' | 'dismiss', notes?: string): Promise<DiffDetail | undefined>;
    batchReview(resultId: string, diffIds: string[], reviewer: string, action: 'confirm' | 'resolve' | 'dismiss', notes?: string): Promise<DiffDetail[]>;
    getReviewHistory(diffId: string): import("../types").ReviewRecord[];
    recalculateResult(resultId: string): Promise<import("../types").ReconciliationResult | undefined>;
}
export declare const reviewService: ReviewService;
