import 'reflect-metadata';
export declare enum TaskStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    BLOCKED = "BLOCKED"
}
export declare class UpgradeTask {
    id: string;
    vulnerabilityId: string;
    title: string;
    description: string;
    packageName: string;
    fromVersion: string;
    toVersion: string;
    status: TaskStatus;
    assigneeId: string;
    assigneeName: string;
    completedAt: Date;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}
