import { Contract, Milestone, DeliveryProof, AcceptanceForm, Invoice, PaymentRecord, OperationRecord, ValidationIssue, EntityType } from "./types";
export interface Database {
    contracts: Contract[];
    milestones: Milestone[];
    deliveryProofs: DeliveryProof[];
    acceptanceForms: AcceptanceForm[];
    invoices: Invoice[];
    paymentRecords: PaymentRecord[];
    operations: OperationRecord[];
    issues: ValidationIssue[];
    initializedAt: string;
    lastUpdatedAt: string;
    version: string;
}
export type EntityName = "contracts" | "milestones" | "deliveryProofs" | "acceptanceForms" | "invoices" | "paymentRecords" | "operations" | "issues";
export declare const ENTITY_MAP: Record<EntityType, EntityName>;
export declare const DATABASE_VERSION = "1.0.0";
export declare function createEmptyDatabase(): Database;
