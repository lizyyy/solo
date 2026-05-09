import { PackingListService } from './packing-list.service';
import { CreatePackingListDto, UpdatePackingListDto, PackingListFilterDto } from './dto/packing-list.dto';
import { PackingList } from '../../entities/packing-list.entity';
import { DocumentStatus } from '../../entities/invoice.entity';
export declare class PackingListController {
    private readonly packingListService;
    constructor(packingListService: PackingListService);
    create(dto: CreatePackingListDto): Promise<PackingList>;
    findAll(filter: PackingListFilterDto): Promise<PackingList[]>;
    findByBatch(batchId: string): Promise<PackingList[]>;
    findLatestByBatch(batchId: string): Promise<PackingList | null>;
    findOne(id: string): Promise<PackingList>;
    update(id: string, dto: UpdatePackingListDto): Promise<PackingList>;
    updateStatus(id: string, status: DocumentStatus): Promise<PackingList>;
    remove(id: string): Promise<void>;
}
