import { ClearanceBatch } from './clearance-batch.entity';
export declare enum DocumentStatus {
    DRAFT = "draft",
    SUBMITTED = "submitted",
    VERIFIED = "verified",
    REJECTED = "rejected"
}
export declare class Invoice {
    id: string;
    batch: ClearanceBatch;
    batchId: string;
    invoiceNumber: string;
    version: number;
    invoiceDate: string;
    shipperName: string;
    consigneeName: string;
    totalAmount: number;
    currency: string;
    totalQuantity: number;
    itemCount: number;
    status: DocumentStatus;
    items: Array<{
        lineNumber: number;
        hsCode: string;
        productName: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        totalAmount: number;
    }>;
    remarks: string;
    createdAt: Date;
    updatedAt: Date;
}
