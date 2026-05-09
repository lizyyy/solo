import { Repository } from 'typeorm';
import { Invoice, DocumentStatus } from '../../entities/invoice.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceFilterDto } from './dto/invoice.dto';
export declare class InvoiceService {
    private readonly invoiceRepository;
    private readonly batchService;
    constructor(invoiceRepository: Repository<Invoice>, batchService: ClearanceBatchService);
    create(dto: CreateInvoiceDto): Promise<Invoice>;
    findAll(filter: InvoiceFilterDto): Promise<Invoice[]>;
    findOne(id: string): Promise<Invoice>;
    findByBatch(batchId: string): Promise<Invoice[]>;
    findLatestByBatch(batchId: string): Promise<Invoice | null>;
    update(id: string, dto: UpdateInvoiceDto): Promise<Invoice>;
    remove(id: string): Promise<void>;
    updateStatus(id: string, status: DocumentStatus): Promise<Invoice>;
}
