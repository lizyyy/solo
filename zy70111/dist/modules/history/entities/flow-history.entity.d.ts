import { FlowAction, CertificateStatus } from '../../../common/types';
import { Certificate } from '../../certificate/entities/certificate.entity';
export declare class FlowHistory {
    id: string;
    certificateNumber: string;
    certificateId: string;
    action: FlowAction;
    description: string;
    previousStatus: CertificateStatus;
    newStatus: CertificateStatus;
    operatorId: string;
    operatorName: string;
    sourceSystem: string;
    changes: string;
    snapshot: string;
    relatedEntityId: string;
    relatedEntityType: string;
    isManualCorrection: boolean;
    correctionReason: string;
    certificate: Certificate;
    createdAt: Date;
}
