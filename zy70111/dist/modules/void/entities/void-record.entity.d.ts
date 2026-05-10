import { VoidReason } from '../../../common/types';
export declare class VoidRecord {
    id: string;
    certificateNumber: string;
    certificateId: string;
    reason: VoidReason;
    reasonDetails: string;
    isReissued: boolean;
    reissuedCertificateId: string;
    reissuedCertificateNumber: string;
    requestedBy: string;
    requestedByName: string;
    approvedBy: string;
    approvedByName: string;
    approvedAt: Date;
    remarks: string;
    metadata: Record<string, any>;
    createdAt: Date;
}
