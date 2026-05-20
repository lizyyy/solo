import { DiffDetail, ReconciliationResult, MaintenanceRecord, SensorData, ApprovalRecord } from '../types';
export declare class ReconciliationService {
    performReconciliation(batchId: string): Promise<ReconciliationResult>;
    private checkTrialRun;
    private checkKeyItems;
    private checkOverdueRelease;
    private checkMaintenanceFail;
    private checkSensorAbnormal;
    private checkApprovalMissing;
    private createDiff;
    private calculateSummary;
    private countPassedCableCars;
    recalculateSummary(resultId: string): Promise<ReconciliationResult | undefined>;
    getDiffsByCableCar(cableCarId: string, resultId: string): DiffDetail[] | undefined;
    getTraceabilityChain(cableCarId: string, resultId: string): {
        cableCarId: string;
        diffs: DiffDetail[];
        maintenanceRecords: MaintenanceRecord[];
        sensorData: SensorData[];
        approvalRecords: ApprovalRecord[];
        finalStatus: string;
    } | undefined;
}
export declare const reconciliationService: ReconciliationService;
