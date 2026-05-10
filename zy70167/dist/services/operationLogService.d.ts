import { OperationType, OperationLog } from '../types';
export declare function logOperation(operationType: OperationType, entityType: string, entityId: string, description: string, operator: string, options?: {
    fromStatus?: string;
    toStatus?: string;
    metadata?: Record<string, unknown>;
}): Promise<void>;
export declare function getEntityHistory(entityType: string, entityId: string, options?: {
    page?: number;
    pageSize?: number;
}): Promise<{
    logs: OperationLog[];
    total: number;
}>;
export declare function getAllLogs(options?: {
    page?: number;
    pageSize?: number;
    operationType?: OperationType;
    entityType?: string;
}): Promise<{
    logs: OperationLog[];
    total: number;
}>;
//# sourceMappingURL=operationLogService.d.ts.map