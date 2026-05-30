import { SettlementApplication, SettlementStatus, ReasonDetail } from '../types/models';
export declare class SettlementStateMachine {
    private createReason;
    canTransition(currentStatus: SettlementStatus, targetStatus: SettlementStatus, userRole: string): boolean;
    getAvailableTransitions(currentStatus: SettlementStatus, userRole: string): SettlementStatus[];
    transition(application: SettlementApplication, targetStatus: SettlementStatus, userRole: string, operator: string, remark?: string): {
        success: boolean;
        updatedApplication: SettlementApplication;
        reason: ReasonDetail;
    };
    isEditable(status: SettlementStatus): boolean;
    isCorrectionAllowed(status: SettlementStatus): boolean;
}
