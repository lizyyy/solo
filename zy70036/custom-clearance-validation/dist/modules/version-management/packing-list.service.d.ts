import { Repository } from 'typeorm';
import { PackingList } from '../../entities/packing-list.entity';
import { DocumentStatus } from '../../entities/invoice.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import { CreatePackingListDto, UpdatePackingListDto, PackingListFilterDto } from './dto/packing-list.dto';
export declare class PackingListService {
    private readonly packingListRepository;
    private readonly batchService;
    constructor(packingListRepository: Repository<PackingList>, batchService: ClearanceBatchService);
    create(dto: CreatePackingListDto): Promise<PackingList>;
    findAll(filter: PackingListFilterDto): Promise<PackingList[]>;
    findOne(id: string): Promise<PackingList>;
    findByBatch(batchId: string): Promise<PackingList[]>;
    findLatestByBatch(batchId: string): Promise<PackingList | null>;
    update(id: string, dto: UpdatePackingListDto): Promise<PackingList>;
    remove(id: string): Promise<void>;
    updateStatus(id: string, status: DocumentStatus): Promise<PackingList>;
}
