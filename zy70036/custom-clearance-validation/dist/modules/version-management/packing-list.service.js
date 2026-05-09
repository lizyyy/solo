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
exports.PackingListService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const packing_list_entity_1 = require("../../entities/packing-list.entity");
const invoice_entity_1 = require("../../entities/invoice.entity");
const clearance_batch_service_1 = require("../clearance-batch/clearance-batch.service");
let PackingListService = class PackingListService {
    packingListRepository;
    batchService;
    constructor(packingListRepository, batchService) {
        this.packingListRepository = packingListRepository;
        this.batchService = batchService;
    }
    async create(dto) {
        await this.batchService.findOne(dto.batchId);
        const existingLists = await this.packingListRepository.find({
            where: { batchId: dto.batchId },
            order: { version: 'DESC' },
        });
        const newVersion = existingLists.length > 0 ? existingLists[0].version + 1 : 1;
        await this.packingListRepository.update({ batchId: dto.batchId }, { status: invoice_entity_1.DocumentStatus.DRAFT });
        const packingList = this.packingListRepository.create({
            ...dto,
            version: newVersion,
            status: invoice_entity_1.DocumentStatus.SUBMITTED,
        });
        return this.packingListRepository.save(packingList);
    }
    async findAll(filter) {
        const queryBuilder = this.packingListRepository.createQueryBuilder('packingList');
        if (filter.batchId) {
            queryBuilder.andWhere('packingList.batchId = :batchId', { batchId: filter.batchId });
        }
        if (filter.packingListNumber) {
            queryBuilder.andWhere('packingList.packingListNumber LIKE :packingListNumber', {
                packingListNumber: `%${filter.packingListNumber}%`,
            });
        }
        if (filter.status) {
            queryBuilder.andWhere('packingList.status = :status', { status: filter.status });
        }
        queryBuilder.orderBy('packingList.createdAt', 'DESC');
        return queryBuilder.getMany();
    }
    async findOne(id) {
        const packingList = await this.packingListRepository.findOne({ where: { id } });
        if (!packingList) {
            throw new common_1.NotFoundException(`箱单 ${id} 不存在`);
        }
        return packingList;
    }
    async findByBatch(batchId) {
        return this.packingListRepository.find({
            where: { batchId },
            order: { version: 'DESC' },
        });
    }
    async findLatestByBatch(batchId) {
        const lists = await this.packingListRepository.find({
            where: { batchId },
            order: { version: 'DESC' },
            take: 1,
        });
        return lists.length > 0 ? lists[0] : null;
    }
    async update(id, dto) {
        const packingList = await this.findOne(id);
        Object.assign(packingList, dto);
        return this.packingListRepository.save(packingList);
    }
    async remove(id) {
        const result = await this.packingListRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`箱单 ${id} 不存在`);
        }
    }
    async updateStatus(id, status) {
        const packingList = await this.findOne(id);
        packingList.status = status;
        return this.packingListRepository.save(packingList);
    }
};
exports.PackingListService = PackingListService;
exports.PackingListService = PackingListService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(packing_list_entity_1.PackingList)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        clearance_batch_service_1.ClearanceBatchService])
], PackingListService);
//# sourceMappingURL=packing-list.service.js.map