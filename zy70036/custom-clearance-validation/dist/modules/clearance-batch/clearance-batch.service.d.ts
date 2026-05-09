import { Repository } from 'typeorm';
import { ClearanceBatch, ClearanceBatchStatus } from '../../entities/clearance-batch.entity';
import { CreateClearanceBatchDto, UpdateClearanceBatchDto, ClearanceBatchFilterDto } from './dto/clearance-batch.dto';
export declare class ClearanceBatchService {
    private readonly batchRepository;
    constructor(batchRepository: Repository<ClearanceBatch>);
    create(dto: CreateClearanceBatchDto): Promise<ClearanceBatch>;
    findAll(filter: ClearanceBatchFilterDto): Promise<ClearanceBatch[]>;
    findOne(id: string): Promise<ClearanceBatch>;
    update(id: string, dto: UpdateClearanceBatchDto): Promise<ClearanceBatch>;
    remove(id: string): Promise<void>;
    updateStatus(id: string, status: ClearanceBatchStatus): Promise<ClearanceBatch>;
}
