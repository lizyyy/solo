import 'reflect-metadata';
export declare enum DelayRequestStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}
export declare class DelayRequest {
    id: string;
    vulnerabilityId: string;
    requesterId: string;
    requesterName: string;
    originalDueDate: Date;
    newDueDate: Date;
    reason: string;
    riskMitigation: string;
    status: DelayRequestStatus;
    approverId: string;
    approverName: string;
    approvedAt: Date;
    approvalComment: string;
    createdAt: Date;
}
