import 'reflect-metadata';
import { RiskLevel } from '../types';
export declare enum RiskStatus {
    OPEN = "OPEN",
    MITIGATED = "MITIGATED",
    ACCEPTED = "ACCEPTED",
    CLOSED = "CLOSED"
}
export declare class RiskItem {
    id: string;
    vulnerabilityId: string;
    title: string;
    description: string;
    level: RiskLevel;
    status: RiskStatus;
    mitigationPlan: string;
    ownerId: string;
    ownerName: string;
    dueDate: Date;
    resolvedAt: Date;
    resolutionNote: string;
    createdAt: Date;
    updatedAt: Date;
}
