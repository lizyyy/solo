import { Appeal, AppealStatus, LiabilityParty } from '../types';
export declare const getAppealStatusName: (status: AppealStatus) => string;
export declare const createAppeal: (orderId: string, compensationId: string, appellantParty: LiabilityParty, appellantId: string, appealReason: string, appealEvidence: string | null) => Appeal;
export declare const getAppeals: (orderId: string) => Appeal[];
export declare const getAppealById: (appealId: string) => Appeal;
export declare const reviewAppeal: (appealId: string, reviewerId: string, reviewerRole: string, approved: boolean, reviewResult: string) => Appeal;
export declare const startReview: (appealId: string, reviewerId: string, reviewerRole: string) => Appeal;
export declare const manualRollback: (compensationId: string, operatorId: string, operatorRole: string, reason: string) => void;
