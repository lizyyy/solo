import { ReturnStatus, ReturnBatch } from '../types';
export declare class StateMachineService {
    private static canTransition;
    static transition(batchId: string, transitionKey: string, reason: string, operatorId: string, operatorName: string, context?: any): Promise<ReturnBatch>;
    static createBatch(batchData: Omit<ReturnBatch, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'isArchived' | 'equipmentList'>, equipmentItems: Omit<import('../types').EquipmentItem, 'id' | 'batchId' | 'createdAt' | 'updatedAt'>[], operatorId: string, operatorName: string): Promise<ReturnBatch>;
    static getBatchDetail(batchId: string): Promise<ReturnBatch | null>;
    static validateDataConsistency(batch: ReturnBatch): {
        valid: boolean;
        errors: string[];
    };
    static getAvailableTransitions(status: ReturnStatus): Promise<string[]>;
    static getTransitionDescription(transitionKey: string): string;
}
