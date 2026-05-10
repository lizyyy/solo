import { Repository } from 'typeorm';
import { DelayRequest, DelayRequestStatus } from '../entities/DelayRequest';
import { RiskItem } from '../entities/RiskItem';
import { Vulnerability } from '../entities/Vulnerability';
import { RiskLevel } from '../types';
export declare class DelayService {
    private delayRepo;
    private riskItemRepo;
    private vulnerabilityRepo;
    constructor(delayRepo: Repository<DelayRequest>, riskItemRepo: Repository<RiskItem>, vulnerabilityRepo: Repository<Vulnerability>);
    createDelayRequest(vulnerabilityId: string, requesterId: string, requesterName: string, newDueDate: Date, reason: string, riskMitigation: string, isManualOverride?: boolean): Promise<{
        request: DelayRequest;
        warnings: string[];
        additionalRisk?: RiskLevel;
    }>;
    private createAssociatedRisk;
    approveDelayRequest(requestId: string, approverId: string, approverName: string, comment: string): Promise<DelayRequest>;
    rejectDelayRequest(requestId: string, approverId: string, approverName: string, comment: string): Promise<DelayRequest>;
    getDelayRequests(vulnerabilityId?: string, status?: DelayRequestStatus): Promise<DelayRequest[]>;
}
