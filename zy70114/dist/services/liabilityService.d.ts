import { LiabilityJudgment, LiabilityParty } from '../types';
export declare const getLiabilityPartyName: (party: LiabilityParty) => string;
export declare const autoJudgeLiability: (orderId: string) => LiabilityJudgment;
export declare const manualJudgeLiability: (orderId: string, liableParty: LiabilityParty, reason: string, evidence: string | null, operatorId: string, operatorRole: string) => LiabilityJudgment;
export declare const getLiabilityJudgment: (orderId: string) => LiabilityJudgment | null;
export declare const getPendingLiabilityOrders: () => {
    orderId: string;
    overtimeMinutes: number;
    analysis: any;
}[];
