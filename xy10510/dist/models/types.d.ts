export type Status = "pending" | "active" | "completed" | "cancelled";
export interface Contract {
    id: string;
    contractNo: string;
    name: string;
    client: string;
    startDate: string;
    endDate: string;
    totalAmount: number;
    status: Status;
    createdAt: string;
    updatedAt: string;
}
export interface Milestone {
    id: string;
    contractId: string;
    milestoneNo: string;
    name: string;
    amount: number;
    expectedDeliveryDate: string;
    description: string;
    status: MilestoneStatus;
    createdAt: string;
    updatedAt: string;
}
export type MilestoneStatus = "not_started" | "delivered" | "accepted" | "invoiced" | "paid" | "partially_paid" | "overdue";
export interface DeliveryProof {
    id: string;
    milestoneId: string;
    proofNo: string;
    deliveryDate: string;
    description: string;
    filePath?: string;
    status: "submitted" | "reviewing" | "approved" | "rejected";
    createdAt: string;
    updatedAt: string;
}
export interface AcceptanceForm {
    id: string;
    milestoneId: string;
    formNo: string;
    acceptanceDate: string;
    acceptedAmount: number;
    description: string;
    filePath?: string;
    status: "draft" | "submitted" | "signed" | "rejected";
    createdAt: string;
    updatedAt: string;
}
export interface Invoice {
    id: string;
    milestoneId: string;
    invoiceNo: string;
    invoiceDate: string;
    amount: number;
    taxRate?: number;
    filePath?: string;
    status: "draft" | "issued" | "received" | "voided";
    createdAt: string;
    updatedAt: string;
}
export interface PaymentRecord {
    id: string;
    invoiceId?: string;
    milestoneId?: string;
    contractId?: string;
    paymentNo: string;
    paymentDate: string;
    amount: number;
    payer: string;
    remark?: string;
    status: "matched" | "unmatched" | "partially_matched" | "cancelled";
    matchedIds?: string[];
    createdAt: string;
    updatedAt: string;
}
export type EntityType = "contract" | "milestone" | "deliveryProof" | "acceptanceForm" | "invoice" | "paymentRecord";
export interface OperationRecord {
    id: string;
    entityType: EntityType;
    entityId: string;
    operation: "create" | "update" | "delete" | "match" | "unmatch" | "import" | "correct";
    operator: string;
    timestamp: string;
    description: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    success: boolean;
    failureReason?: string;
}
export interface ValidationIssue {
    id: string;
    type: "warning" | "error" | "info";
    entityType: EntityType;
    entityId: string;
    code: string;
    message: string;
    severity: "critical" | "high" | "medium" | "low";
    suggestion?: string;
    createdAt: string;
}
export interface DashboardSummary {
    totalContracts: number;
    totalAmount: number;
    totalDelivered: number;
    totalAccepted: number;
    totalInvoiced: number;
    totalPaid: number;
    overdueCount: number;
    overdueAmount: number;
    unmatchedPayments: number;
    issues: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}
