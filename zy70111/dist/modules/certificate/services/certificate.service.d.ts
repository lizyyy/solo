import { Repository, DataSource } from 'typeorm';
import { Certificate } from '../entities/certificate.entity';
import { CertificateDuplicate } from '../entities/certificate-duplicate.entity';
import { CertificateStatus, FlowAction, ProcessingResult, UserContext, PaginatedResult } from '../../../common/types';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { CreateCertificateDto, ManualCorrectionDto, CertificateQueryDto } from '../dto/certificate.dto';
export declare class CertificateService {
    private readonly certificateRepository;
    private readonly duplicateRepository;
    private readonly dataSource;
    private readonly flowHistoryService;
    private readonly auditLogService;
    private readonly logger;
    constructor(certificateRepository: Repository<Certificate>, duplicateRepository: Repository<CertificateDuplicate>, dataSource: DataSource, flowHistoryService: FlowHistoryService, auditLogService: AuditLogService);
    private readonly VALID_STATUS_TRANSITIONS;
    create(dto: CreateCertificateDto, user: UserContext): Promise<ProcessingResult<Certificate>>;
    private createDuplicateRecord;
    private compareCertificates;
    private createReviewTaskForDuplicate;
    findByNumber(certificateNumber: string): Promise<Certificate[]>;
    findById(id: string): Promise<Certificate>;
    getCertificateDetail(certificateNumber: string): Promise<ProcessingResult<{
        certificate: Certificate;
        duplicates: Certificate[];
        flowHistory: any;
        hasDuplicate: boolean;
        needsManualReview: boolean;
    }>>;
    query(query: CertificateQueryDto): Promise<PaginatedResult<Certificate>>;
    updateStatus(certificateId: string, newStatus: CertificateStatus, user: UserContext, options?: {
        reason?: string;
        relatedEntityId?: string;
        relatedEntityType?: string;
        action?: FlowAction;
        actionDescription?: string;
        isManualCorrection?: boolean;
    }): Promise<ProcessingResult<Certificate>>;
    manualCorrection(certificateId: string, dto: ManualCorrectionDto, user: UserContext): Promise<ProcessingResult<Certificate>>;
    getStatistics(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        bySource: Record<string, number>;
        duplicates: number;
        manuallyCorrected: number;
    }>;
}
