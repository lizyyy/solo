import { ReviewStatus, ReviewPriority } from '../../../common/types';
import { Certificate } from './certificate.entity';
export declare class CertificateDuplicate {
    id: string;
    certificateNumber: string;
    certificateId: string;
    conflictingCertificateId: string;
    status: ReviewStatus;
    priority: ReviewPriority;
    conflictReason: string;
    conflictDetails: Record<string, any>;
    isPrimary: boolean;
    resolution: string;
    resolvedBy: string;
    resolvedByName: string;
    resolvedAt: Date;
    certificate: Certificate;
    createdAt: Date;
}
