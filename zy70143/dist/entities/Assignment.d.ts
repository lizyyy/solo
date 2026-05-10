import 'reflect-metadata';
export declare class Assignment {
    id: string;
    vulnerabilityId: string;
    assigneeId: string;
    assigneeName: string;
    assignmentNote: string;
    acceptedAt: Date;
    rejectedAt: Date;
    rejectionReason: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
