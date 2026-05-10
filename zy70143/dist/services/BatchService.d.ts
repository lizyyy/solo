import { Repository } from 'typeorm';
import { Batch } from '../entities/Batch';
import { Vulnerability } from '../entities/Vulnerability';
import { UpgradeTask, TaskStatus } from '../entities/UpgradeTask';
import { VulnerabilityStatus, BatchStatus } from '../types';
export declare class BatchService {
    private batchRepo;
    private vulnerabilityRepo;
    private upgradeTaskRepo;
    constructor(batchRepo: Repository<Batch>, vulnerabilityRepo: Repository<Vulnerability>, upgradeTaskRepo: Repository<UpgradeTask>);
    createBatch(data: {
        name: string;
        code: string;
        description: string;
        plannedDate: Date;
        ownerId?: string;
        ownerName?: string;
    }): Promise<Batch>;
    getBatch(id: string): Promise<Batch | null>;
    listBatches(status?: BatchStatus): Promise<Batch[]>;
    addVulnerabilityToBatch(batchId: string, vulnerabilityId: string): Promise<void>;
    getBatchVulnerabilities(batchId: string): Promise<Vulnerability[]>;
    checkBatchHealth(batchId: string): Promise<{
        batch: Batch;
        vulnerabilities: Vulnerability[];
        consistent: boolean;
        issues: string[];
        summary: {
            total: number;
            byStatus: Record<VulnerabilityStatus, number>;
            overdue: number;
        };
    }>;
    deployBatch(batchId: string, deployedAt?: Date): Promise<Batch>;
    createUpgradeTask(data: {
        vulnerabilityId: string;
        title: string;
        description: string;
        packageName: string;
        fromVersion: string;
        toVersion: string;
        assigneeId?: string;
        assigneeName?: string;
    }): Promise<UpgradeTask>;
    getUpgradeTasks(vulnerabilityId?: string, status?: TaskStatus): Promise<UpgradeTask[]>;
    completeUpgradeTask(taskId: string, notes?: string): Promise<UpgradeTask>;
}
