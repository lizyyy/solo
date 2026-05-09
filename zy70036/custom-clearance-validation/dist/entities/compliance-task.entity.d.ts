import { ClearanceBatch } from './clearance-batch.entity';
export declare enum TaskPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum TaskStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    RESOLVED = "resolved",
    CANCELLED = "cancelled"
}
export declare enum MissingComponentType {
    HS_CODE = "hs_code",
    INVOICE = "invoice",
    PACKING_LIST = "packing_list",
    PRODUCT_INFO = "product_info",
    WEIGHT = "weight",
    QUANTITY = "quantity",
    VALUE = "value",
    OTHER = "other"
}
export declare class ComplianceTask {
    id: string;
    batch: ClearanceBatch;
    batchId: string;
    title: string;
    description: string;
    componentType: MissingComponentType;
    priority: TaskPriority;
    status: TaskStatus;
    assignee: string;
    dueDate: Date;
    resolvedAt: Date;
    resolutionNotes: string;
    affectedItems: Array<{
        lineNumber: number;
        hsCode: string;
        productName: string;
        issue: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
