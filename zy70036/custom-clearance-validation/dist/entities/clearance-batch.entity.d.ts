export declare enum ClearanceBatchStatus {
    DRAFT = "draft",
    SUBMITTED = "submitted",
    VALIDATING = "validating",
    PASSED = "passed",
    BLOCKED = "blocked",
    COMPLETED = "completed"
}
export declare class ClearanceBatch {
    id: string;
    batchNumber: string;
    shipmentNumber: string;
    originCountry: string;
    destinationCountry: string;
    status: ClearanceBatchStatus;
    remarks: string;
    createdAt: Date;
    updatedAt: Date;
}
