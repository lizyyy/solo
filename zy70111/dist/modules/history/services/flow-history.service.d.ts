import { Repository } from 'typeorm';
import { FlowHistory } from '../entities/flow-history.entity';
import { FlowAction, CertificateStatus, UserContext } from '../../../common/types';
export declare class FlowHistoryService {
    private readonly flowHistoryRepository;
    constructor(flowHistoryRepository: Repository<FlowHistory>);
    recordAction(params: {
        certificateNumber: string;
        certificateId: string;
        action: FlowAction;
        description: string;
        previousStatus?: CertificateStatus;
        newStatus?: CertificateStatus;
        user: UserContext;
        changes?: any;
        snapshot?: any;
        relatedEntityId?: string;
        relatedEntityType?: string;
        isManualCorrection?: boolean;
        correctionReason?: string;
    }): Promise<FlowHistory>;
    findByCertificateNumber(certificateNumber: string): Promise<FlowHistory[]>;
    findByCertificateId(certificateId: string): Promise<FlowHistory[]>;
    findByRelatedEntity(relatedEntityType: string, relatedEntityId: string): Promise<FlowHistory[]>;
    findManualCorrectionHistory(certificateId: string): Promise<FlowHistory[]>;
    getCertificateFullTimeline(certificateNumber: string): Promise<{
        histories: FlowHistory[];
        statusChanges: Array<{
            from: string;
            to: string;
            action: string;
            operator: string;
            time: Date;
        }>;
        hasManualCorrection: boolean;
        lastManualCorrection?: FlowHistory;
    }>;
    getStatistics(certificateIds: string[]): Promise<{
        totalActions: number;
        manualCorrections: number;
        actionBreakdown: Record<string, number>;
    }>;
}
