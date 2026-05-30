import { SettlementApplication, OverdueRecord, AnomalyMarker, ReasonDetail } from '../types/models';
export declare class AnomalyDetector {
    private createReason;
    private createAnomaly;
    detectServiceFeeMissingRefund(application: SettlementApplication): {
        anomaly?: AnomalyMarker;
        reason?: ReasonDetail;
    };
    detectOverdueNotSettled(overdueRecords: OverdueRecord[]): {
        anomalies: AnomalyMarker[];
        reasons: ReasonDetail[];
    };
    detectDuplicateApplication(contractNo: string, applicationDate: string, existingApplications: SettlementApplication[], currentApplicationId?: string): {
        anomaly?: AnomalyMarker;
        reason?: ReasonDetail;
    };
    detectAll(application: SettlementApplication, overdueRecords: OverdueRecord[], existingApplications: SettlementApplication[]): {
        anomalies: AnomalyMarker[];
        reasons: ReasonDetail[];
    };
    resolveAnomaly(application: SettlementApplication, anomalyType: string, resolvedBy: string, resolveReason: string): SettlementApplication;
}
