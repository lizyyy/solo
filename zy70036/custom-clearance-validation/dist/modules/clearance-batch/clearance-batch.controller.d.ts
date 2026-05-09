import { ClearanceBatchService } from './clearance-batch.service';
import { CreateClearanceBatchDto, UpdateClearanceBatchDto, ClearanceBatchFilterDto } from './dto/clearance-batch.dto';
import { ClearanceBatch } from '../../entities/clearance-batch.entity';
export declare class ClearanceBatchController {
    private readonly batchService;
    constructor(batchService: ClearanceBatchService);
    create(dto: CreateClearanceBatchDto): Promise<ClearanceBatch>;
    findAll(filter: ClearanceBatchFilterDto): Promise<ClearanceBatch[]>;
    findOne(id: string): Promise<ClearanceBatch>;
    update(id: string, dto: UpdateClearanceBatchDto): Promise<ClearanceBatch>;
    remove(id: string): Promise<void>;
}
