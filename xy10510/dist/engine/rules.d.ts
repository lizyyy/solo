import { DataStore } from "../storage/store";
import { Milestone, DeliveryProof, AcceptanceForm, Invoice, PaymentRecord, ValidationIssue, DashboardSummary } from "../models/types";
export declare class BusinessRulesEngine {
    private store;
    constructor(store?: DataStore);
    validateAll(): ValidationIssue[];
    validateMilestone(milestone: Milestone): ValidationIssue[];
    updateMilestoneStatuses(): void;
    checkDuplicatePayment(paymentNo: string): PaymentRecord | undefined;
    checkDuplicateInvoice(invoiceNo: string): Invoice | undefined;
    checkDuplicateAcceptance(formNo: string): AcceptanceForm | undefined;
    checkDuplicateDelivery(proofNo: string): DeliveryProof | undefined;
    calculateDashboardSummary(): DashboardSummary;
    getNextActions(): string[];
}
export declare const defaultEngine: BusinessRulesEngine;
