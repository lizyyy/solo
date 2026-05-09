"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("../../entities/invoice.entity");
const clearance_batch_service_1 = require("../clearance-batch/clearance-batch.service");
let InvoiceService = class InvoiceService {
    invoiceRepository;
    batchService;
    constructor(invoiceRepository, batchService) {
        this.invoiceRepository = invoiceRepository;
        this.batchService = batchService;
    }
    async create(dto) {
        await this.batchService.findOne(dto.batchId);
        const existingInvoices = await this.invoiceRepository.find({
            where: { batchId: dto.batchId },
            order: { version: 'DESC' },
        });
        const newVersion = existingInvoices.length > 0 ? existingInvoices[0].version + 1 : 1;
        await this.invoiceRepository.update({ batchId: dto.batchId }, { status: invoice_entity_1.DocumentStatus.DRAFT });
        const invoice = this.invoiceRepository.create({
            ...dto,
            version: newVersion,
            status: invoice_entity_1.DocumentStatus.SUBMITTED,
        });
        return this.invoiceRepository.save(invoice);
    }
    async findAll(filter) {
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
    async findOne(id) {
        const invoice = await this.invoiceRepository.findOne({ where: { id } });
        if (!invoice) {
            throw new common_1.NotFoundException(`发票 ${id} 不存在`);
        }
        return invoice;
    }
    async findByBatch(batchId) {
        return this.invoiceRepository.find({
            where: { batchId },
            order: { version: 'DESC' },
        });
    }
    async findLatestByBatch(batchId) {
        const invoices = await this.invoiceRepository.find({
            where: { batchId },
            order: { version: 'DESC' },
            take: 1,
        });
        return invoices.length > 0 ? invoices[0] : null;
    }
    async update(id, dto) {
        const invoice = await this.findOne(id);
        Object.assign(invoice, dto);
        return this.invoiceRepository.save(invoice);
    }
    async remove(id) {
        const result = await this.invoiceRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`发票 ${id} 不存在`);
        }
    }
    async updateStatus(id, status) {
        const invoice = await this.findOne(id);
        invoice.status = status;
        return this.invoiceRepository.save(invoice);
    }
};
exports.InvoiceService = InvoiceService;
exports.InvoiceService = InvoiceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        clearance_batch_service_1.ClearanceBatchService])
], InvoiceService);
//# sourceMappingURL=invoice.service.js.map