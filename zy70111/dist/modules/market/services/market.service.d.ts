import { Repository, DataSource } from 'typeorm';
import { MarketInspection } from '../entities/market-inspection.entity';
import { Certificate } from '../../certificate/entities/certificate.entity';
import { ProcessingResult, UserContext, PaginatedResult } from '../../../common/types';
import { CertificateService } from '../../certificate/services/certificate.service';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { MarketInspectionDto, MarketQueryDto } from '../dto/market.dto';
export declare class MarketService {
    private readonly inspectionRepository;
    private readonly certificateRepository;
    private readonly dataSource;
    private readonly certificateService;
    private readonly flowHistoryService;
    private readonly auditLogService;
    private readonly logger;
    constructor(inspectionRepository: Repository<MarketInspection>, certificateRepository: Repository<Certificate>, dataSource: DataSource, certificateService: CertificateService, flowHistoryService: FlowHistoryService, auditLogService: AuditLogService);
    inspect(dto: MarketInspectionDto, user: UserContext): Promise<ProcessingResult<{
        inspection: MarketInspection;
        certificate?: Certificate;
        warnings: string[];
    }>>;
    query(query: MarketQueryDto): Promise<PaginatedResult<MarketInspection>>;
    findById(id: string): Promise<MarketInspection>;
}
