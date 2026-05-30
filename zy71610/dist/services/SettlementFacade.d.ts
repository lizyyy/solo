import { SettlementApplication, SettlementStatement, SettlementFilter, ExportOptions } from '../types/models';
export declare class SettlementFacade {
    private calculator;
    private stateMachine;
    private flowVerifier;
    private anomalyDetector;
    createSettlementApplication(contractNo: string, applicant: string, settlementReason: string, operator: string, expectedSettlementDate?: string): SettlementApplication;
    recalculateSettlement(applicationId: string, operator: string): SettlementApplication;
    correctValue(applicationId: string, fieldName: 'remainingPrincipal' | 'remainingServiceFee' | 'refundableServiceFee' | 'earlySettlementPenalty' | 'totalPayableAmount', correctedValue: number, correctedBy: string, correctionReason: string): SettlementApplication;
    transitionStatus(applicationId: string, targetStatus: string, userRole: string, operator: string, remark?: string): SettlementApplication;
    updateRemark(applicationId: string, remark: string, operator: string): SettlementApplication;
    resolveAnomaly(applicationId: string, anomalyType: string, resolvedBy: string, resolveReason: string): SettlementApplication;
    getApplication(applicationId: string): SettlementApplication | undefined;
    listApplications(filter?: SettlementFilter): SettlementApplication[];
    getHistory(applicationId: string): import("../types/models").SettlementHistory[];
    createStatement(applicationId: string, createdBy: string): SettlementStatement;
    getStatement(statementId: string): SettlementStatement | undefined;
    exportApplications(filter: SettlementFilter, options: ExportOptions): string | Buffer;
    exportDetailedReport(applicationId: string): string;
    getAvailableTransitions(status: string, userRole: string): import("../types/models").SettlementStatus[];
}
export declare const settlementFacade: SettlementFacade;
