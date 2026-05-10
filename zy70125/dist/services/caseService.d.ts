import { EquipmentCase, ServiceResult } from '../types';
interface CreateCaseItemInput {
    name: string;
    quantity: number;
    unitValue: number;
    serialNumber?: string;
    condition?: 'new' | 'good' | 'fair' | 'poor';
}
interface CreateCaseInput {
    caseNumber: string;
    name: string;
    description?: string;
    cityIdentifier: string;
    items: CreateCaseItemInput[];
}
export declare function createCase(input: CreateCaseInput): ServiceResult<EquipmentCase>;
export declare function getCaseByIdentifier(identifier: string): ServiceResult<EquipmentCase>;
export declare function listCases(cityIdentifier?: string, statusFilter?: string): ServiceResult<EquipmentCase[]>;
export declare function updateCaseItems(caseIdentifier: string, items: CreateCaseItemInput[]): ServiceResult<EquipmentCase>;
export declare function getCaseStatusLabel(status: string): string;
export {};
