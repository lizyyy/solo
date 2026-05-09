import { Repository } from 'typeorm';
import { HsCodeVersion, HsCodeVerificationStatus } from '../../entities/hs-code-version.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import { CreateHsCodeVersionDto, HsCodeVersionFilterDto } from './dto/hs-code-version.dto';
export declare class HsCodeVersionService {
    private readonly hsCodeRepository;
    private readonly batchService;
    constructor(hsCodeRepository: Repository<HsCodeVersion>, batchService: ClearanceBatchService);
    create(dto: CreateHsCodeVersionDto): Promise<HsCodeVersion[]>;
    findAll(filter: HsCodeVersionFilterDto): Promise<HsCodeVersion[]>;
    findActiveByBatch(batchId: string): Promise<HsCodeVersion[]>;
    findActiveByBatchAndSource(batchId: string, source: string): Promise<HsCodeVersion[]>;
    findLatestVersionByBatchAndSource(batchId: string, source: string): Promise<number>;
    updateVerificationStatus(id: string, status: HsCodeVerificationStatus, message?: string): Promise<HsCodeVersion>;
}
