import { BillingRecord, ReviewStatus, BillingSummary } from '../types';
export declare class BillingCalculatorService {
    private SPIKE_THRESHOLD;
    calculateBillingForPeriod(periodStart: Date, periodEnd: Date): Promise<BillingRecord[]>;
    private calculateTenantZoneBilling;
    private isOvertimeForReading;
    private calculateVacancyOverlap;
    private detectConsumptionSpikes;
    recalculateRecord(recordId: string): Promise<BillingRecord | undefined>;
    getBillingSummary(periodStart: Date, periodEnd: Date): BillingSummary;
    getBillingRecords(periodStart: Date, periodEnd: Date, tenantId?: string, status?: ReviewStatus): BillingRecord[];
}
export declare const billingCalculatorService: BillingCalculatorService;
