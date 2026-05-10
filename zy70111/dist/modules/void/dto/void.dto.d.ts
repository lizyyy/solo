import { VoidReason } from '../../../common/types';
export declare class VoidCertificateDto {
    certificateId: string;
    reason: VoidReason;
    reasonDetails: string;
    shouldReissue?: boolean;
    newCertificateNumber?: string;
    remarks?: string;
}
export declare class ReissueCertificateDto {
    originalCertificateId: string;
    newCertificateNumber: string;
    reason: string;
    remarks?: string;
}
