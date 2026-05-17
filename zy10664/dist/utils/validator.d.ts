import { CreateTaskRequest, UpdateTaskRequest, ApplyRecoveryRequest, AuditRecoveryRequest, WithdrawRequest, ManualRemarkRequest, RecordFailureRequest, ValidationError } from '../types';
export declare class Validator {
    private errors;
    getErrors(): ValidationError[];
    hasErrors(): boolean;
    private addError;
    validateCreateTask(data: CreateTaskRequest): boolean;
    validateUpdateTask(data: UpdateTaskRequest): boolean;
    validateApplyRecovery(data: ApplyRecoveryRequest): boolean;
    validateAuditRecovery(data: AuditRecoveryRequest): boolean;
    validateWithdraw(data: WithdrawRequest): boolean;
    validateManualRemark(data: ManualRemarkRequest): boolean;
    validateRecordFailure(data: RecordFailureRequest): boolean;
    validateImportRow(data: any, rowIndex: number): boolean;
}
export declare const validator: Validator;
