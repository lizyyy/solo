import { BatchService } from '../services/batch.service';
import { CreateBatchDto, BindCertificatesDto, UnbindCertificatesDto, BatchQueryDto } from '../dto/batch.dto';
import { UserContext } from '../../../common/types';
export declare class BatchController {
    private readonly batchService;
    constructor(batchService: BatchService);
    create(dto: CreateBatchDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<import("../entities/batch.entity").Batch>>;
    bindCertificates(dto: BindCertificatesDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<{
        batch: import("../entities/batch.entity").Batch;
        boundCount: number;
        duplicates: string[];
        warnings: string[];
    }>>;
    unbindCertificates(dto: UnbindCertificatesDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<{
        batch: import("../entities/batch.entity").Batch;
        unboundCount: number;
    }>>;
    getDetail(batchId: string): Promise<import("../../../common/types").ProcessingResult<{
        batch: import("../entities/batch.entity").Batch;
        certificates: import("../../certificate/entities/certificate.entity").Certificate[];
        hasDuplicates: boolean;
        duplicateCertificates: string[];
    }>>;
    getById(id: string): Promise<import("../entities/batch.entity").Batch>;
    query(query: BatchQueryDto): Promise<import("../../../common/types").PaginatedResult<import("../entities/batch.entity").Batch>>;
    updateStatus(id: string, body: {
        status: string;
        reason?: string;
    }, user: UserContext): Promise<import("../../../common/types").ProcessingResult<import("../entities/batch.entity").Batch>>;
}
