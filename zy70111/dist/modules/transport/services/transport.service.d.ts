import { Repository, DataSource } from 'typeorm';
import { TransportRecord } from '../entities/transport-record.entity';
import { Certificate } from '../../certificate/entities/certificate.entity';
import { ProcessingResult, UserContext, PaginatedResult } from '../../../common/types';
import { BatchService } from '../../batch/services/batch.service';
import { CertificateService } from '../../certificate/services/certificate.service';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { CreateTransportDto, VerifyTransportDto, TransportQueryDto } from '../dto/transport.dto';
export declare class TransportService {
    private readonly transportRepository;
    private readonly certificateRepository;
    private readonly dataSource;
    private readonly batchService;
    private readonly certificateService;
    private readonly flowHistoryService;
    private readonly auditLogService;
    private readonly logger;
    constructor(transportRepository: Repository<TransportRecord>, certificateRepository: Repository<Certificate>, dataSource: DataSource, batchService: BatchService, certificateService: CertificateService, flowHistoryService: FlowHistoryService, auditLogService: AuditLogService);
    create(dto: CreateTransportDto, user: UserContext): Promise<ProcessingResult<{
        transport: TransportRecord;
        certificates: Certificate[];
        hasDuplicates: boolean;
        duplicateCertificates: string[];
    }>>;
    verifyTransport(dto: VerifyTransportDto, user: UserContext): Promise<ProcessingResult<{
        transport: TransportRecord;
        verifiedCount: number;
        warnings: string[];
    }>>;
    findById(id: string): Promise<TransportRecord>;
    getTransportDetail(transportId: string): Promise<ProcessingResult<{
        transport: TransportRecord;
        certificates: Certificate[];
        hasDuplicates: boolean;
        duplicateCertificates: string[];
    }>>;
    query(query: TransportQueryDto): Promise<PaginatedResult<TransportRecord>>;
}
