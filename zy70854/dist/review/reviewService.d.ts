import { MatchRecord, ReviewRecord, ItemStatus, ReviewAction, DifferenceType, PassengerLostItem, DriverTurnedInItem, WarehouseItem } from '../types';
export declare class ReviewService {
    private reviewHistory;
    recordReview(matchId: string, reviewer: string, action: ReviewAction, previousStatus: ItemStatus, newStatus: ItemStatus, reason: string, changes?: {
        field: string;
        oldValue: string;
        newValue: string;
    }[]): ReviewRecord;
    startReview(match: MatchRecord, reviewer: string): {
        match: MatchRecord;
        reviewRecord: ReviewRecord;
    };
    approveMatch(match: MatchRecord, reviewer: string, reason: string): {
        match: MatchRecord;
        reviewRecord: ReviewRecord;
    };
    rejectMatch(match: MatchRecord, reviewer: string, reason: string): {
        match: MatchRecord;
        reviewRecord: ReviewRecord;
    };
    manualMatch(match: MatchRecord, reviewer: string, reason: string, targetIds: {
        passengerItemId?: string;
        driverItemId?: string;
        warehouseItemId?: string;
    }): {
        match: MatchRecord;
        reviewRecord: ReviewRecord;
    };
    unmatch(match: MatchRecord, reviewer: string, reason: string): {
        match: MatchRecord;
        reviewRecord: ReviewRecord;
    };
    requestMoreInfo(match: MatchRecord, reviewer: string, reason: string): {
        match: MatchRecord;
        reviewRecord: ReviewRecord;
    };
    addDifferenceExplanation(match: MatchRecord, explanation: string, differenceType?: DifferenceType): MatchRecord;
    getReviewHistory(matchId: string): ReviewRecord[];
    getAllReviewHistory(): ReviewRecord[];
    getReviewRecordsByReviewer(reviewer: string): ReviewRecord[];
    getReviewRecordsByDateRange(startDate: string, endDate: string): ReviewRecord[];
    getAuditTrail(matchId: string): string[];
    private getActionText;
    validateMatchConsistency(match: MatchRecord, passengerItems: PassengerLostItem[], driverItems: DriverTurnedInItem[], warehouseItems: WarehouseItem[]): {
        valid: boolean;
        issues: string[];
    };
}
