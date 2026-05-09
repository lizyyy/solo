import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, DocumentStatus } from '../../entities/invoice.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceFilterDto,
} from './dto/invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly batchService: ClearanceBatchService,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    await this.batchService.findOne(dto.batchId);

    const existingInvoices = await this.invoiceRepository.find({
      where: { batchId: dto.batchId },
      order: { version: 'DESC' },
    });

    const newVersion = existingInvoices.length > 0 ? existingInvoices[0].version + 1 : 1;

    await this.invoiceRepository.update(
      { batchId: dto.batchId },
      { status: DocumentStatus.DRAFT },
    );

    const invoice = this.invoiceRepository.create({
      ...dto,
      version: newVersion,
      status: DocumentStatus.SUBMITTED,
    });

    return this.invoiceRepository.save(invoice);
  }

  async findAll(filter: InvoiceFilterDto): Promise<Invoice[]> {
    const queryBuilder = this.invoiceRepository.createQueryBuilder('invoice');

    if (filter.batchId) {
      queryBuilder.andWhere('invoice.batchId = :batchId', { batchId: filter.batchId });
    }

    if (filter.invoiceNumber) {
      queryBuilder.andWhere('invoice.invoiceNumber LIKE :invoiceNumber', {
        invoiceNumber: `%${filter.invoiceNumber}%`,
      });
    }

    if (filter.status) {
      queryBuilder.andWhere('invoice.status = :status', { status: filter.status });
    }

    queryBuilder.orderBy('invoice.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`发票 ${id} 不存在`);
    }
    return invoice;
  }

  async findByBatch(batchId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: { batchId },
      order: { version: 'DESC' },
    });
  }

  async findLatestByBatch(batchId: string): Promise<Invoice | null> {
    const invoices = await this.invoiceRepository.find({
      where: { batchId },
      order: { version: 'DESC' },
      take: 1,
    });
    return invoices.length > 0 ? invoices[0] : null;
  }

  async update(id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(id);
    Object.assign(invoice, dto);
    return this.invoiceRepository.save(invoice);
  }

  async remove(id: string): Promise<void> {
    const result = await this.invoiceRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`发票 ${id} 不存在`);
    }
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<Invoice> {
    const invoice = await this.findOne(id);
    invoice.status = status;
    return this.invoiceRepository.save(invoice);
  }
}
