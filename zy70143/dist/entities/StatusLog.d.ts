import 'reflect-metadata';
import { VulnerabilityStatus } from '../types';
export declare class StatusLog {
    id: string;
    vulnerabilityId: string;
    fromStatus: VulnerabilityStatus;
    toStatus: VulnerabilityStatus;
    operatorId: string;
    operatorName: string;
    reason: string;
    isManualOverride: boolean;
    createdAt: Date;
}
