import { Repository, DataSource } from 'typeorm';
import { Batch } from '../entities/batch.entity';
import { Certificate } from '../../certificate/entities/certificate.entity';
import { ProcessingResult, UserContext, PaginatedResult } from '../../../common/types';
import { CertificateService } from '../../certificate/services/certificate.service';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { CreateBatchDto, BindCertificatesDto, UnbindCertificatesDto, BatchQueryDto } from '../dto/batch.dto';
export declare class BatchService {
    private readonly batchRepository;
    private readonly certificateRepository;
    private readonly dataSource;
    private readonly certificateService;
    private readonly flowHistoryService;
    private readonly auditLogService;
    private readonly logger;
    constructor(batchRepository: Repository<Batch>, certificateRepository: Repository<Certificate>, dataSource: DataSource, certificateService: CertificateService, flowHistoryService: FlowHistoryService, auditLogService: AuditLogService);
    create(dto: CreateBatchDto, user: UserContext): Promise<ProcessingResult<Batch>>;
    bindCertificates(dto: BindCertificatesDto, user: UserContext): Promise<ProcessingResult<{
        batch: Batch;
        boundCount: number;
        duplicates: string[];
        warnings: string[];
    }>>;
    unbindCertificates(dto: UnbindCertificatesDto, user: UserContext): Promise<ProcessingResult<{
        batch: Batch;
        unboundCount: number;
    }>>;
    findById(id: string): Promise<Batch>;
    getBatchDetail(batchId: string): Promise<ProcessingResult<{
        batch: Batch;
        certificates: Certificate[];
        hasDuplicates: boolean;
        duplicateCertificates: string[];
    }>>;
    query(query: BatchQueryDto): Promise<PaginatedResult<Batch>>;
    updateBatchStatus(batchId: string, newStatus: string, user: UserContext, reason?: string): Promise<ProcessingResult<Batch>>;
}
