import { WorkRecord, BillingResult } from '../types';
export declare class BillingEngine {
    private config;
    calculateBilling(record: WorkRecord): BillingResult;
    private calculateBaseAmount;
    private checkCrossDay;
    private checkMinimumCharge;
    private checkDuplicate;
    private checkAlreadyBilled;
    batchCalculate(records: WorkRecord[]): BillingResult[];
}
export declare const billingEngine: BillingEngine;
