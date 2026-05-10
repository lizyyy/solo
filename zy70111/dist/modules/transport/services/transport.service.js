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
var TransportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const transport_record_entity_1 = require("../entities/transport-record.entity");
const certificate_entity_1 = require("../../certificate/entities/certificate.entity");
const types_1 = require("../../../common/types");
const exceptions_1 = require("../../../common/exceptions");
const batch_service_1 = require("../../batch/services/batch.service");
const certificate_service_1 = require("../../certificate/services/certificate.service");
const flow_history_service_1 = require("../../history/services/flow-history.service");
const audit_log_service_1 = require("../../history/services/audit-log.service");
let TransportService = TransportService_1 = class TransportService {
    constructor(transportRepository, certificateRepository, dataSource, batchService, certificateService, flowHistoryService, auditLogService) {
        this.transportRepository = transportRepository;
        this.certificateRepository = certificateRepository;
        this.dataSource = dataSource;
        this.batchService = batchService;
        this.certificateService = certificateService;
        this.flowHistoryService = flowHistoryService;
        this.auditLogService = auditLogService;
        this.logger = new common_1.Logger(TransportService_1.name);
    }
    async create(dto, user) {
        const batch = await this.batchService.findById(dto.batchId);
        const transport = this.transportRepository.create({
            ...dto,
            batchNumber: batch.batchNumber,
            status: types_1.TransportStatus.PENDING,
            createdBy: user.userId,
            createdByName: user.userName,
        });
        const savedTransport = await this.transportRepository.save(transport);
        const certificates = await this.certificateRepository.find({
            where: { batchId: dto.batchId },
        });
        const duplicateCertificates = [
            ...new Set(certificates.filter((c) => c.hasDuplicate).map((c) => c.certificateNumber)),
        ];
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            for (const cert of certificates) {
                await this.certificateService.updateStatus(cert.id, types_1.CertificateStatus.IN_TRANSPORT, user, {
                    action: types_1.FlowAction.TRANSPORT_STARTED,
                    actionDescription: `开始运输，运输单号: ${savedTransport.transportNumber}`,
                    relatedEntityId: savedTransport.id,
                    relatedEntityType: 'transport',
                });
            }
            savedTransport.status = types_1.TransportStatus.IN_PROGRESS;
            await queryRunner.manager.save(transport_record_entity_1.TransportRecord, savedTransport);
            await this.auditLogService.log({
                entityType: types_1.EntityType.TRANSPORT,
                entityId: savedTransport.id,
                entityNumber: savedTransport.transportNumber,
                action: 'CREATE',
                description: `创建运输记录: ${savedTransport.transportNumber}`,
                user,
                afterData: { ...savedTransport },
            });
            await queryRunner.commitTransaction();
            const needsReview = duplicateCertificates.length > 0;
            return {
                success: true,
                data: {
                    transport: savedTransport,
                    certificates,
                    hasDuplicates: duplicateCertificates.length > 0,
                    duplicateCertificates,
                },
                needsReview,
                reviewReason: needsReview ? 'TRANSPORT_CONTAINS_DUPLICATE_CERTS' : undefined,
                reviewPriority: needsReview ? types_1.ReviewPriority.HIGH : undefined,
                message: needsReview
                    ? `运输创建成功，但包含 ${duplicateCertificates.length} 个重复证号，建议在核销前人工复核`
                    : '运输创建成功，所有检疫证已进入运输状态',
                warnings: needsReview
                    ? [`包含重复证号：${duplicateCertificates.join(', ')}，建议人工复核`]
                    : [],
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
    async verifyTransport(dto, user) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const transport = await this.transportRepository.findOne({
                where: { id: dto.transportId },
            });
            if (!transport) {
                throw new exceptions_1.TransportNotFoundException(dto.transportId);
            }
            if (transport.status !== types_1.TransportStatus.IN_PROGRESS) {
                throw new exceptions_1.InvalidStatusTransitionException(transport.status, types_1.TransportStatus.VERIFIED, `运输记录状态为 ${transport.status}，无法核销`);
            }
            const allBatchCerts = await this.certificateRepository.find({
                where: { batchId: transport.batchId },
            });
            let certsToVerify;
            if (dto.certificateIds?.length) {
                certsToVerify = allBatchCerts.filter((c) => dto.certificateIds.includes(c.id));
            }
            else {
                certsToVerify = allBatchCerts;
            }
            const warnings = [];
            const duplicateCerts = certsToVerify.filter((c) => c.hasDuplicate);
            let actuallyVerified = 0;
            for (const cert of certsToVerify) {
                if (cert.status !== types_1.CertificateStatus.IN_TRANSPORT) {
                    warnings.push(`检疫证 ${cert.certificateNumber} 状态为 ${cert.status}，已跳过`);
                    continue;
                }
                await this.certificateService.updateStatus(cert.id, types_1.CertificateStatus.TRANSPORT_VERIFIED, user, {
                    action: types_1.FlowAction.TRANSPORT_VERIFIED,
                    actionDescription: `运输核销完成，运输单号: ${transport.transportNumber}`,
                    relatedEntityId: transport.id,
                    relatedEntityType: 'transport',
                });
                actuallyVerified++;
            }
            transport.status = types_1.TransportStatus.VERIFIED;
            transport.verifiedAt = new Date();
            transport.verifiedBy = user.userId;
            transport.verifiedByName = user.userName;
            transport.actualArrivalTime = dto.actualArrivalTime || new Date();
            transport.verificationRemarks = dto.verificationRemarks;
            transport.hasAnomaly = dto.hasAnomaly || false;
            transport.anomalyDescription = dto.anomalyDescription;
            await queryRunner.manager.save(transport_record_entity_1.TransportRecord, transport);
            await this.auditLogService.log({
                entityType: types_1.EntityType.TRANSPORT,
                entityId: transport.id,
                entityNumber: transport.transportNumber,
                action: 'VERIFY',
                description: `运输核销: ${transport.transportNumber}`,
                user,
                beforeData: { status: types_1.TransportStatus.IN_PROGRESS },
                afterData: { status: types_1.TransportStatus.VERIFIED },
                requestData: dto,
            });
            await queryRunner.commitTransaction();
            const needsReview = duplicateCerts.length > 0;
            return {
                success: true,
                data: {
                    transport,
                    verifiedCount: actuallyVerified,
                    warnings,
                },
                needsReview,
                reviewReason: needsReview ? 'VERIFIED_WITH_DUPLICATE_CERTS' : undefined,
                reviewPriority: needsReview ? types_1.ReviewPriority.HIGH : undefined,
                message: needsReview
                    ? `核销成功 ${actuallyVerified} 张，但包含 ${duplicateCerts.length} 张重复证号，需市场端重点关注`
                    : `运输核销成功，共 ${actuallyVerified} 张检疫证`,
                warnings: warnings.concat(needsReview
                    ? [`注意：本次核销包含 ${duplicateCerts.length} 张重复证号，市场端验收时请重点核验`]
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
    async findById(id) {
        const transport = await this.transportRepository.findOne({ where: { id } });
        if (!transport) {
            throw new exceptions_1.TransportNotFoundException(id);
        }
        return transport;
    }
    async getTransportDetail(transportId) {
        const transport = await this.findById(transportId);
        const certificates = await this.certificateRepository.find({
            where: { batchId: transport.batchId },
            order: { createdAt: 'DESC' },
        });
        const duplicateCertificates = [
            ...new Set(certificates.filter((c) => c.hasDuplicate).map((c) => c.certificateNumber)),
        ];
        return {
            success: true,
            data: {
                transport,
                certificates,
                hasDuplicates: duplicateCertificates.length > 0,
                duplicateCertificates,
            },
            needsReview: duplicateCertificates.length > 0,
            message: duplicateCertificates.length > 0
                ? `运输详情查询成功，包含 ${duplicateCertificates.length} 个重复证号`
                : '运输详情查询成功',
        };
    }
    async query(query) {
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const qb = this.transportRepository.createQueryBuilder('transport');
        if (query.transportNumber) {
            qb.andWhere('transport.transportNumber LIKE :transportNumber', {
                transportNumber: `%${query.transportNumber}%`,
            });
        }
        if (query.batchNumber) {
            qb.andWhere('transport.batchNumber LIKE :batchNumber', {
                batchNumber: `%${query.batchNumber}%`,
            });
        }
        if (query.status?.length) {
            qb.andWhere('transport.status IN (:...status)', { status: query.status });
        }
        if (query.vehiclePlateNumber) {
            qb.andWhere('transport.vehiclePlateNumber LIKE :plate', {
                plate: `%${query.vehiclePlateNumber}%`,
            });
        }
        if (query.hasAnomaly !== undefined) {
            qb.andWhere('transport.hasAnomaly = :hasAnomaly', {
                hasAnomaly: query.hasAnomaly,
            });
        }
        const [items, total] = await qb
            .orderBy('transport.createdAt', 'DESC')
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
};
exports.TransportService = TransportService;
exports.TransportService = TransportService = TransportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transport_record_entity_1.TransportRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(certificate_entity_1.Certificate)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        batch_service_1.BatchService,
        certificate_service_1.CertificateService,
        flow_history_service_1.FlowHistoryService,
        audit_log_service_1.AuditLogService])
], TransportService);
//# sourceMappingURL=transport.service.js.map