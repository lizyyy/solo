import { RiskCheckResult } from '../types';
export declare class RiskCheckService {
    checkVerification(fromIsVerified: boolean, toIsVerified: boolean): RiskCheckResult;
    checkCoolDown(lastTransferTime: number | null, currentTime: number): RiskCheckResult;
    checkFrequency(transferCountInHour: number, transferCountInDay: number): RiskCheckResult;
    checkFrozen(fromIsFrozen: boolean, collectionIsFrozen: boolean): RiskCheckResult;
    checkOwnership(ownerId: string, fromUserId: string): RiskCheckResult;
    checkSelfTransfer(fromUserId: string, toUserId: string): RiskCheckResult;
    aggregateResults(results: RiskCheckResult[]): RiskCheckResult;
    private isHigherRisk;
}
export declare const riskCheckService: RiskCheckService;
