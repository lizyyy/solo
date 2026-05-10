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
var BatchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const batch_entity_1 = require("../entities/batch.entity");
const certificate_entity_1 = require("../../certificate/entities/certificate.entity");
const types_1 = require("../../../common/types");
const exceptions_1 = require("../../../common/exceptions");
const certificate_service_1 = require("../../certificate/services/certificate.service");
const flow_history_service_1 = require("../../history/services/flow-history.service");
const audit_log_service_1 = require("../../history/services/audit-log.service");
let BatchService = BatchService_1 = class BatchService {
    constructor(batchRepository, certificateRepository, dataSource, certificateService, flowHistoryService, auditLogService) {
        this.batchRepository = batchRepository;
        this.certificateRepository = certificateRepository;
        this.dataSource = dataSource;
        this.certificateService = certificateService;
        this.flowHistoryService = flowHistoryService;
        this.auditLogService = auditLogService;
        this.logger = new common_1.Logger(BatchService_1.name);
    }
    async create(dto, user) {
        const batch = this.batchRepository.create({
            ...dto,
            status: 'created',
            createdBy: user.userId,
            createdByName: user.userName,
        });
        const savedBatch = await this.batchRepository.save(batch);
        await this.auditLogService.log({
            entityType: types_1.EntityType.BATCH,
            entityId: savedBatch.id,
            entityNumber: savedBatch.batchNumber,
            action: 'CREATE',
            description: `创建批次: ${savedBatch.batchNumber}`,
            user,
            afterData: { ...savedBatch },
        });
        return {
            success: true,
            data: savedBatch,
            needsReview: false,
            message: '批次创建成功',
        };
    }
    async bindCertificates(dto, user) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const batch = await this.batchRepository.findOne({
                where: { id: dto.batchId },
            });
            if (!batch) {
                throw new exceptions_1.BatchNotFoundException(dto.batchId);
            }
            const certificates = await this.certificateRepository.find({
                where: { id: (0, typeorm_2.In)(dto.certificateIds) },
            });
            if (certificates.length !== dto.certificateIds.length) {
                const foundIds = certificates.map((c) => c.id);
                const missingIds = dto.certificateIds.filter((id) => !foundIds.includes(id));
                throw new exceptions_1.CertificateNotFoundException(missingIds.join(', '));
            }
            const warnings = [];
            const duplicateCerts = [];
            let actuallyBound = 0;
            for (const cert of certificates) {
                if (cert.batchId && cert.batchId !== batch.id) {
                    warnings.push(`检疫证 ${cert.certificateNumber} 已绑定到其他批次，已跳过`);
                    continue;
                }
                if (cert.batchId === batch.id) {
                    warnings.push(`检疫证 ${cert.certificateNumber} 已绑定到当前批次，已跳过`);
                    continue;
                }
                if (cert.status !== types_1.CertificateStatus.ISSUED && cert.status !== types_1.CertificateStatus.DUPLICATE_DETECTED) {
                    throw new exceptions_1.InvalidStatusTransitionException(cert.status, types_1.CertificateStatus.BATCH_BOUND, `检疫证 ${cert.certificateNumber} 状态为 ${cert.status}，无法绑定到批次`);
                }
                if (cert.hasDuplicate) {
                    duplicateCerts.push(cert.certificateNumber);
                }
                cert.batchId = batch.id;
                cert.batchNumber = batch.batchNumber;
                cert.lastOperatorId = user.userId;
                cert.lastOperatorName = user.userName;
                await this.certificateService.updateStatus(cert.id, types_1.CertificateStatus.BATCH_BOUND, user, {
                    action: types_1.FlowAction.BATCH_BOUND,
                    actionDescription: `绑定到批次 ${batch.batchNumber}`,
                    relatedEntityId: batch.id,
                    relatedEntityType: 'batch',
                });
                actuallyBound++;
            }
            if (actuallyBound > 0) {
                batch.certificateCount += actuallyBound;
                const updatedCerts = await this.certificateRepository.find({
                    where: { batchId: batch.id },
                });
                batch.totalAnimals = updatedCerts.reduce((sum, c) => sum + c.animalQuantity, 0);
                batch.totalWeight = updatedCerts.reduce((sum, c) => sum + (c.totalWeight || 0), 0);
                batch.hasDuplicateCertificates = updatedCerts.some((c) => c.hasDuplicate);
                await queryRunner.manager.save(batch_entity_1.Batch, batch);
            }
            await queryRunner.commitTransaction();
            const needsReview = duplicateCerts.length > 0;
            return {
                success: true,
                data: {
                    batch,
                    boundCount: actuallyBound,
                    duplicates: duplicateCerts,
                    warnings,
                },
                needsReview,
                reviewReason: needsReview ? 'BATCH_CONTAINS_DUPLICATE_CERTS' : undefined,
                reviewPriority: needsReview ? types_1.ReviewPriority.MEDIUM : undefined,
                message: needsReview
                    ? `绑定成功 ${actuallyBound} 张，但包含 ${duplicateCerts.length} 张重复证号，需要人工复核`
                    : `成功绑定 ${actuallyBound} 张检疫证`,
                warnings: warnings.concat(needsReview
                    ? [`批次包含 ${duplicateCerts.length} 张重复证号：${duplicateCerts.join(', ')}`]
                    : []),
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async unbindCertificates(dto, user) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const batch = await this.batchRepository.findOne({
                where: { id: dto.batchId },
            });
            if (!batch) {
                throw new exceptions_1.BatchNotFoundException(dto.batchId);
            }
            const certificates = await this.certificateRepository.find({
                where: { id: (0, typeorm_2.In)(dto.certificateIds), batchId: batch.id },
            });
            let unboundCount = 0;
            for (const cert of certificates) {
                cert.batchId = null;
                cert.batchNumber = null;
                cert.lastOperatorId = user.userId;
                cert.lastOperatorName = user.userName;
                await this.certificateService.updateStatus(cert.id, types_1.CertificateStatus.ISSUED, user, {
                    action: types_1.FlowAction.BATCH_UNBOUND,
                    actionDescription: `从批次 ${batch.batchNumber} 解绑: ${dto.reason}`,
                    relatedEntityId: batch.id,
                    relatedEntityType: 'batch',
                });
                unboundCount++;
            }
            if (unboundCount > 0) {
                batch.certificateCount -= unboundCount;
                const remainingCerts = await this.certificateRepository.find({
                    where: { batchId: batch.id },
                });
                batch.totalAnimals = remainingCerts.reduce((sum, c) => sum + c.animalQuantity, 0);
                batch.totalWeight = remainingCerts.reduce((sum, c) => sum + (c.totalWeight || 0), 0);
                batch.hasDuplicateCertificates = remainingCerts.some((c) => c.hasDuplicate);
                await queryRunner.manager.save(batch_entity_1.Batch, batch);
            }
            await queryRunner.commitTransaction();
            return {
                success: true,
                data: {
                    batch,
                    unboundCount,
                },
                needsReview: false,
                message: `成功解绑 ${unboundCount} 张检疫证`,
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async findById(id) {
        const batch = await this.batchRepository.findOne({ where: { id } });
        if (!batch) {
            throw new exceptions_1.BatchNotFoundException(id);
        }
        return batch;
    }
    async getBatchDetail(batchId) {
        const batch = await this.findById(batchId);
        const certificates = await this.certificateRepository.find({
            where: { batchId },
            order: { createdAt: 'DESC' },
        });
        const duplicateCertificates = certificates
            .filter((c) => c.hasDuplicate)
            .map((c) => c.certificateNumber);
        const uniqueDuplicates = [...new Set(duplicateCertificates)];
        return {
            success: true,
            data: {
                batch,
                certificates,
                hasDuplicates: uniqueDuplicates.length > 0,
                duplicateCertificates: uniqueDuplicates,
            },
            needsReview: uniqueDuplicates.length > 0,
            message: uniqueDuplicates.length > 0
                ? `批次详情查询成功，包含 ${uniqueDuplicates.length} 个重复证号`
                : '批次详情查询成功',
        };
    }
    async query(query) {
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const qb = this.batchRepository.createQueryBuilder('batch');
        if (query.batchNumber) {
            qb.andWhere('batch.batchNumber LIKE :batchNumber', {
                batchNumber: `%${query.batchNumber}%`,
            });
        }
        if (query.status?.length) {
            qb.andWhere('batch.status IN (:...status)', { status: query.status });
        }
        if (query.destination) {
            qb.andWhere('batch.destination LIKE :destination', {
                destination: `%${query.destination}%`,
            });
        }
        if (query.hasDuplicateCertificates !== undefined) {
            qb.andWhere('batch.hasDuplicateCertificates = :hasDuplicate', {
                hasDuplicate: query.hasDuplicateCertificates,
            });
        }
        const [items, total] = await qb
            .orderBy('batch.createdAt', 'DESC')
            .skip(skip)
            .take(pageSize)
            .getManyAndCount();
        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    async updateBatchStatus(batchId, newStatus, user, reason) {
        const batch = await this.findById(batchId);
        const beforeData = { ...batch };
        batch.status = newStatus;
        const savedBatch = await this.batchRepository.save(batch);
        await this.auditLogService.log({
            entityType: types_1.EntityType.BATCH,
            entityId: batchId,
            entityNumber: batch.batchNumber,
            action: 'STATUS_UPDATE',
            description: `批次状态变更: ${beforeData.status} -> ${newStatus}`,
            user,
            beforeData: { status: beforeData.status },
            afterData: { status: newStatus },
            remarks: reason,
        });
        return {
            success: true,
            data: savedBatch,
            needsReview: false,
            message: '批次状态更新成功',
        };
    }
};
exports.BatchService = BatchService;
exports.BatchService = BatchService = BatchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(batch_entity_1.Batch)),
    __param(1, (0, typeorm_1.InjectRepository)(certificate_entity_1.Certificate)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        certificate_service_1.CertificateService,
        flow_history_service_1.FlowHistoryService,
        audit_log_service_1.AuditLogService])
], BatchService);
//# sourceMappingURL=batch.service.js.map