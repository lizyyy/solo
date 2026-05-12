import { Batch, Defect, CommandResult } from '../types';
export declare function createBatch(params: {
    batchNumber: string;
    productCode: string;
    productName: string;
    quantity: number;
    productionDate: string;
    productionLine: string;
}): CommandResult<Batch>;
export declare function recordInitialInspection(params: {
    batchNumber: string;
    sampleCount: number;
    defects: Defect[];
    inspector: string;
    notes?: string;
    sheetNumber: string;
}): CommandResult<Batch>;
export declare function recordReinspection(params: {
    batchNumber: string;
    sampleCount: number;
    defects: Defect[];
    inspector: string;
    notes?: string;
    sheetNumber: string;
}): CommandResult<Batch>;
export declare function requestConcession(params: {
    batchNumber: string;
    reason: string;
    justification: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    requestedBy: string;
}): CommandResult<Batch>;
export declare function approveConcession(params: {
    batchNumber: string;
    approvedBy: string;
    approvalNotes?: string;
}): CommandResult<Batch>;
export declare function approveRework(params: {
    batchNumber: string;
    approvedBy: string;
    reason: string;
}): CommandResult<Batch>;
export declare function closeBatch(params: {
    batchNumber: string;
    closedBy: string;
    reason?: string;
}): CommandResult<Batch>;
export declare function manualCorrection(params: {
    batchNumber: string;
    correctedBy: string;
    field: string;
    oldValue: any;
    newValue: any;
    reason: string;
}): CommandResult<Batch>;
