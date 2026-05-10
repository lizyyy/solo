import { EntityType, HistoryRecord } from '../types';
export declare const createHistoryRecord: (entityType: EntityType, entityId: string, action: string, description: string, operator: string, beforeState?: Record<string, any>, afterState?: Record<string, any>, ipAddress?: string) => HistoryRecord;
export declare const getHistoryByEntity: (entityType: EntityType, entityId: string) => HistoryRecord[];
export declare const getAllHistory: (entityType?: EntityType, startTime?: string, endTime?: string, operator?: string, page?: number, pageSize?: number) => {
    items: HistoryRecord[];
    total: number;
};
