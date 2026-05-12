import { Member, Benefit, BenefitStatus, FreezeReason, LedgerEntry, ManualCorrectionDiff, OperationResult, BenefitQueryResult } from '../types';
export declare const benefitService: {
    createMember(params: {
        requestId: string;
        name: string;
        phone: string;
    }): OperationResult<Member>;
    grantBenefit(params: {
        requestId: string;
        memberId: string;
        benefitType: string;
        benefitName: string;
        totalDays: number;
    }): OperationResult<Benefit>;
    freezeBenefit(params: {
        requestId: string;
        benefitId: string;
        reason: FreezeReason;
        detail: string;
        operator?: string;
    }): OperationResult<Benefit>;
    unfreezeBenefit(params: {
        requestId: string;
        benefitId: string;
        reason: string;
        operator?: string;
    }): OperationResult<Benefit>;
    processRefund(params: {
        requestId: string;
        benefitId: string;
        detail: string;
        operator?: string;
    }): OperationResult<Benefit>;
    compensateBenefit(params: {
        requestId: string;
        benefitId: string;
        days: number;
        reason: string;
        operator?: string;
    }): OperationResult<Benefit>;
    manualCorrect(params: {
        requestId: string;
        benefitId: string;
        changes: Partial<{
            remainingDays: number;
            status: BenefitStatus;
            name: string;
        }>;
        operator: string;
        reason: string;
    }): OperationResult<{
        benefit: Benefit;
        diffs: ManualCorrectionDiff[];
    }>;
    queryBenefit(params: {
        benefitId: string;
        requestId?: string;
    }): OperationResult<BenefitQueryResult>;
    generateLedgerExplanation(history: LedgerEntry[]): string[];
    queryMemberBenefits(params: {
        memberId: string;
        requestId?: string;
    }): OperationResult<BenefitQueryResult[]>;
    getMember(params: {
        memberId: string;
    }): OperationResult<Member>;
    exportReport(params: {
        memberId?: string;
        benefitId?: string;
    }): OperationResult<any[]>;
    clearAll(): void;
    getAllData(): {
        members: Member[];
        benefits: Benefit[];
        ledgers: LedgerEntry[];
    };
};
