import {
  Contract,
  Milestone,
  DeliveryProof,
  AcceptanceForm,
  Invoice,
  PaymentRecord,
  OperationRecord,
  ValidationIssue,
  EntityType,
} from "./types";

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

export type EntityName =
  | "contracts"
  | "milestones"
  | "deliveryProofs"
  | "acceptanceForms"
  | "invoices"
  | "paymentRecords"
  | "operations"
  | "issues";

export const ENTITY_MAP: Record<EntityType, EntityName> = {
  contract: "contracts",
  milestone: "milestones",
  deliveryProof: "deliveryProofs",
  acceptanceForm: "acceptanceForms",
  invoice: "invoices",
  paymentRecord: "paymentRecords",
};

export const DATABASE_VERSION = "1.0.0";

export function createEmptyDatabase(): Database {
  const now = new Date().toISOString();
  return {
    contracts: [],
    milestones: [],
    deliveryProofs: [],
    acceptanceForms: [],
    invoices: [],
    paymentRecords: [],
    operations: [],
    issues: [],
    initializedAt: now,
    lastUpdatedAt: now,
    version: DATABASE_VERSION,
  };
}
