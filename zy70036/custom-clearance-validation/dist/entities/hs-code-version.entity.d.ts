import { ClearanceBatch } from './clearance-batch.entity';
export declare enum HsCodeSource {
    INVOICE = "invoice",
    PACKING_LIST = "packing_list",
    DECLARATION = "declaration"
}
export declare enum HsCodeVerificationStatus {
    PENDING = "pending",
    VALID = "valid",
    INVALID = "invalid",
    MISMATCH = "mismatch"
}
export declare class HsCodeVersion {
    id: string;
    batch: ClearanceBatch;
    batchId: string;
    version: number;
    hsCode: string;
    description: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalAmount: number;
    currency: string;
    source: HsCodeSource;
    verificationStatus: HsCodeVerificationStatus;
    verificationMessage: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
