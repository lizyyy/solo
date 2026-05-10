import { Repository, DataSource } from 'typeorm';
import { VoidRecord } from '../entities/void-record.entity';
import { Certificate } from '../../certificate/entities/certificate.entity';
import { ProcessingResult, UserContext } from '../../../common/types';
import { CertificateService } from '../../certificate/services/certificate.service';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { VoidCertificateDto, ReissueCertificateDto } from '../dto/void.dto';
export declare class VoidService {
    private readonly voidRepository;
    private readonly certificateRepository;
    private readonly dataSource;
    private readonly certificateService;
    private readonly flowHistoryService;
    private readonly auditLogService;
    private readonly logger;
    constructor(voidRepository: Repository<VoidRecord>, certificateRepository: Repository<Certificate>, dataSource: DataSource, certificateService: CertificateService, flowHistoryService: FlowHistoryService, auditLogService: AuditLogService);
    voidCertificate(dto: VoidCertificateDto, user: UserContext): Promise<ProcessingResult<{
        voidRecord: VoidRecord;
        certificate: Certificate;
        reissuedCertificate?: Certificate;
    }>>;
    private internalReissue;
    reissueCertificate(dto: ReissueCertificateDto, user: UserContext): Promise<ProcessingResult<{
        originalCertificate: Certificate;
        newCertificate: Certificate;
    }>>;
    findByCertificateId(certificateId: string): Promise<VoidRecord[]>;
    findByCertificateNumber(certificateNumber: string): Promise<VoidRecord[]>;
}
