import { Repository } from 'typeorm';
import { RiskItem, RiskStatus } from '../entities/RiskItem';
import { Vulnerability } from '../entities/Vulnerability';
import { RiskLevel } from '../types';
export declare class RiskService {
    private riskItemRepo;
    private vulnerabilityRepo;
    constructor(riskItemRepo: Repository<RiskItem>, vulnerabilityRepo: Repository<Vulnerability>);
    createRiskItem(data: {
        vulnerabilityId?: string;
        title: string;
        description: string;
        level: RiskLevel;
        mitigationPlan?: string;
        ownerId?: string;
        ownerName?: string;
        dueDate?: Date;
    }): Promise<RiskItem>;
    getRiskItem(id: string): Promise<RiskItem | null>;
    listRiskItems(filters?: {
        status?: RiskStatus;
        level?: RiskLevel;
        vulnerabilityId?: string;
        ownerId?: string;
    }): Promise<RiskItem[]>;
    updateRiskStatus(riskId: string, newStatus: RiskStatus, resolutionNote?: string, operatorId?: string, operatorName?: string): Promise<RiskItem>;
    getRiskDashboard(): Promise<{
        summary: {
            total: number;
            byLevel: Record<RiskLevel, number>;
            byStatus: Record<RiskStatus, number>;
            overdue: number;
        };
        topRisks: RiskItem[];
        recentlyAdded: RiskItem[];
    }>;
}
