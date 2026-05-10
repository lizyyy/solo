import { CertificateService } from '../services/certificate.service';
import { CreateCertificateDto, ManualCorrectionDto, CertificateQueryDto } from '../dto/certificate.dto';
import { UserContext } from '../../../common/types';
export declare class CertificateController {
    private readonly certificateService;
    constructor(certificateService: CertificateService);
    create(dto: CreateCertificateDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<import("../entities/certificate.entity").Certificate>>;
    getDetail(certificateNumber: string): Promise<import("../../../common/types").ProcessingResult<{
        certificate: import("../entities/certificate.entity").Certificate;
        duplicates: import("../entities/certificate.entity").Certificate[];
        flowHistory: any;
        hasDuplicate: boolean;
        needsManualReview: boolean;
    }>>;
    getById(id: string): Promise<import("../entities/certificate.entity").Certificate>;
    getByNumber(certificateNumber: string): Promise<import("../entities/certificate.entity").Certificate[]>;
    query(query: CertificateQueryDto): Promise<import("../../../common/types").PaginatedResult<import("../entities/certificate.entity").Certificate>>;
    manualCorrection(id: string, dto: ManualCorrectionDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<import("../entities/certificate.entity").Certificate>>;
    getStatistics(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        bySource: Record<string, number>;
        duplicates: number;
        manuallyCorrected: number;
    }>;
}
