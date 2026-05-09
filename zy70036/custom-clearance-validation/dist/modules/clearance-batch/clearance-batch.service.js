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
exports.ClearanceBatchService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const clearance_batch_entity_1 = require("../../entities/clearance-batch.entity");
let ClearanceBatchService = class ClearanceBatchService {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    async create(dto) {
        const batch = this.batchRepository.create({
            ...dto,
            status: clearance_batch_entity_1.ClearanceBatchStatus.DRAFT,
        });
        return this.batchRepository.save(batch);
    }
    async findAll(filter) {
        const queryBuilder = this.batchRepository.createQueryBuilder('batch');
        if (filter.batchNumber) {
            queryBuilder.andWhere('batch.batchNumber LIKE :batchNumber', {
                batchNumber: `%${filter.batchNumber}%`,
            });
        }
        if (filter.shipmentNumber) {
            queryBuilder.andWhere('batch.shipmentNumber LIKE :shipmentNumber', {
                shipmentNumber: `%${filter.shipmentNumber}%`,
            });
        }
        if (filter.status) {
            queryBuilder.andWhere('batch.status = :status', { status: filter.status });
        }
        queryBuilder.orderBy('batch.createdAt', 'DESC');
        return queryBuilder.getMany();
    }
    async findOne(id) {
        const batch = await this.batchRepository.findOne({ where: { id } });
        if (!batch) {
            throw new common_1.NotFoundException(`清关批次 ${id} 不存在`);
        }
        return batch;
    }
    async update(id, dto) {
        const batch = await this.findOne(id);
        Object.assign(batch, dto);
        return this.batchRepository.save(batch);
    }
    async remove(id) {
        const result = await this.batchRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`清关批次 ${id} 不存在`);
        }
    }
    async updateStatus(id, status) {
        const batch = await this.findOne(id);
        batch.status = status;
        return this.batchRepository.save(batch);
    }
};
exports.ClearanceBatchService = ClearanceBatchService;
exports.ClearanceBatchService = ClearanceBatchService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(clearance_batch_entity_1.ClearanceBatch)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ClearanceBatchService);
//# sourceMappingURL=clearance-batch.service.js.map