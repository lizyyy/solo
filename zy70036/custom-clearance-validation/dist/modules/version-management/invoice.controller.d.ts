import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceFilterDto } from './dto/invoice.dto';
import { Invoice, DocumentStatus } from '../../entities/invoice.entity';
export declare class InvoiceController {
    private readonly invoiceService;
    constructor(invoiceService: InvoiceService);
    create(dto: CreateInvoiceDto): Promise<Invoice>;
    findAll(filter: InvoiceFilterDto): Promise<Invoice[]>;
    findByBatch(batchId: string): Promise<Invoice[]>;
    findLatestByBatch(batchId: string): Promise<Invoice | null>;
    findOne(id: string): Promise<Invoice>;
    update(id: string, dto: UpdateInvoiceDto): Promise<Invoice>;
    updateStatus(id: string, status: DocumentStatus): Promise<Invoice>;
    remove(id: string): Promise<void>;
}
