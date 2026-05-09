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
exports.HsCodeVersionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const hs_code_version_entity_1 = require("../../entities/hs-code-version.entity");
const clearance_batch_service_1 = require("../clearance-batch/clearance-batch.service");
let HsCodeVersionService = class HsCodeVersionService {
    hsCodeRepository;
    batchService;
    constructor(hsCodeRepository, batchService) {
        this.hsCodeRepository = hsCodeRepository;
        this.batchService = batchService;
    }
    async create(dto) {
        await this.batchService.findOne(dto.batchId);
        const existingCodes = await this.hsCodeRepository.find({
            where: { batchId: dto.batchId, source: dto.source },
            order: { version: 'DESC' },
        });
        const newVersion = existingCodes.length > 0 ? existingCodes[0].version + 1 : 1;
        await this.hsCodeRepository.update({ batchId: dto.batchId, source: dto.source }, { isActive: false });
        const hsCodeVersions = [];
        for (const item of dto.items) {
            const hsCodeVersion = this.hsCodeRepository.create({
                ...item,
                batchId: dto.batchId,
                source: dto.source,
                version: newVersion,
                isActive: true,
                verificationStatus: hs_code_version_entity_1.HsCodeVerificationStatus.PENDING,
            });
            hsCodeVersions.push(hsCodeVersion);
        }
        return this.hsCodeRepository.save(hsCodeVersions);
    }
    async findAll(filter) {
        const queryBuilder = this.hsCodeRepository.createQueryBuilder('hsCode');
        if (filter.batchId) {
            queryBuilder.andWhere('hsCode.batchId = :batchId', { batchId: filter.batchId });
        }
        if (filter.source) {
            queryBuilder.andWhere('hsCode.source = :source', { source: filter.source });
        }
        queryBuilder.orderBy('hsCode.version', 'DESC');
        queryBuilder.addOrderBy('hsCode.createdAt', 'DESC');
        return queryBuilder.getMany();
    }
    async findActiveByBatch(batchId) {
        return this.hsCodeRepository.find({
            where: { batchId, isActive: true },
            order: { source: 'ASC' },
        });
    }
    async findActiveByBatchAndSource(batchId, source) {
        return this.hsCodeRepository.find({
            where: { batchId, isActive: true, source: source },
        });
    }
    async findLatestVersionByBatchAndSource(batchId, source) {
        const codes = await this.hsCodeRepository.find({
            where: { batchId, source: source },
            order: { version: 'DESC' },
            take: 1,
        });
        return codes.length > 0 ? codes[0].version : 0;
    }
    async updateVerificationStatus(id, status, message) {
        const hsCode = await this.hsCodeRepository.findOne({ where: { id } });
        if (!hsCode) {
            throw new Error(`HS编码记录 ${id} 不存在`);
        }
        hsCode.verificationStatus = status;
        if (message) {
            hsCode.verificationMessage = message;
        }
        return this.hsCodeRepository.save(hsCode);
    }
};
exports.HsCodeVersionService = HsCodeVersionService;
exports.HsCodeVersionService = HsCodeVersionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(hs_code_version_entity_1.HsCodeVersion)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        clearance_batch_service_1.ClearanceBatchService])
], HsCodeVersionService);
//# sourceMappingURL=hs-code-version.service.js.map