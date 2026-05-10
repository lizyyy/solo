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
var CertificateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const certificate_entity_1 = require("../entities/certificate.entity");
const certificate_duplicate_entity_1 = require("../entities/certificate-duplicate.entity");
const types_1 = require("../../../common/types");
const exceptions_1 = require("../../../common/exceptions");
const flow_history_service_1 = require("../../history/services/flow-history.service");
const audit_log_service_1 = require("../../history/services/audit-log.service");
let CertificateService = CertificateService_1 = class CertificateService {
    constructor(certificateRepository, duplicateRepository, dataSource, flowHistoryService, auditLogService) {
        this.certificateRepository = certificateRepository;
        this.duplicateRepository = duplicateRepository;
        this.dataSource = dataSource;
        this.flowHistoryService = flowHistoryService;
        this.auditLogService = auditLogService;
        this.logger = new common_1.Logger(CertificateService_1.name);
        this.VALID_STATUS_TRANSITIONS = {
            [types_1.CertificateStatus.ISSUED]: [
                types_1.CertificateStatus.BATCH_BOUND,
                types_1.CertificateStatus.VOIDED,
                types_1.CertificateStatus.DUPLICATE_DETECTED,
                types_1.CertificateStatus.MANUALLY_CORRECTED,
            ],
            [types_1.CertificateStatus.BATCH_BOUND]: [
                types_1.CertificateStatus.IN_TRANSPORT,
                types_1.CertificateStatus.ISSUED,
                types_1.CertificateStatus.VOIDED,
                types_1.CertificateStatus.MANUALLY_CORRECTED,
            ],
            [types_1.CertificateStatus.IN_TRANSPORT]: [
                types_1.CertificateStatus.TRANSPORT_VERIFIED,
                types_1.CertificateStatus.MANUALLY_CORRECTED,
            ],
            [types_1.CertificateStatus.TRANSPORT_VERIFIED]: [
                types_1.CertificateStatus.MARKET_ACCEPTED,
                types_1.CertificateStatus.MANUALLY_CORRECTED,
            ],
            [types_1.CertificateStatus.MARKET_ACCEPTED]: [
                types_1.CertificateStatus.MANUALLY_CORRECTED,
            ],
            [types_1.CertificateStatus.VOIDED]: [
                types_1.CertificateStatus.MANUALLY_CORRECTED,
            ],
            [types_1.CertificateStatus.MANUALLY_CORRECTED]: [
                types_1.CertificateStatus.MANUALLY_CORRECTED,
            ],
            [types_1.CertificateStatus.DUPLICATE_DETECTED]: [
                types_1.CertificateStatus.ISSUED,
                types_1.CertificateStatus.VOIDED,
                types_1.CertificateStatus.MANUALLY_CORRECTED,
            ],
        };
    }
    async create(dto, user) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const existingCerts = await this.certificateRepository.find({
                where: { certificateNumber: dto.certificateNumber },
            });
            const certificate = queryRunner.manager.create(certificate_entity_1.Certificate, {
                ...dto,
                issuerId: user.userId,
                issuerName: user.userName,
                lastOperatorId: user.userId,
                lastOperatorName: user.userName,
            });
            if (existingCerts.length > 0) {
                certificate.status = types_1.CertificateStatus.DUPLICATE_DETECTED;
                certificate.hasDuplicate = true;
            }
            const savedCert = await queryRunner.manager.save(certificate_entity_1.Certificate, certificate);
            await this.flowHistoryService.recordAction({
                certificateNumber: savedCert.certificateNumber,
                certificateId: savedCert.id,
                action: types_1.FlowAction.CERTIFICATE_ISSUED,
                description: `检疫证号 ${savedCert.certificateNumber} 已录入，来源：${dto.source}`,
                previousStatus: null,
                newStatus: savedCert.status,
                user,
                snapshot: {
                    certificateNumber: savedCert.certificateNumber,
                    source: savedCert.source,
                    animalType: savedCert.animalType,
                    animalQuantity: savedCert.animalQuantity,
                },
            });
            if (existingCerts.length > 0) {
                for (const existing of existingCerts) {
                    await this.createDuplicateRecord(savedCert, existing, user, queryRunner);
                }
                await queryRunner.commitTransaction();
                const reviewTask = await this.createReviewTaskForDuplicate(savedCert, existingCerts.length + 1, user);
                return {
                    success: true,
                    data: savedCert,
                    needsReview: true,
                    reviewReason: 'DUPLICATE_CERTIFICATE_NUMBER',
                    reviewPriority: types_1.ReviewPriority.HIGH,
                    message: `检疫证录入成功，但检测到证号 [${savedCert.certificateNumber}] 已存在 ${existingCerts.length} 条记录，需要人工复核`,
                    warnings: [
                        `检测到证号重复，共 ${existingCerts.length + 1} 条记录`,
                        '已自动创建人工复核任务',
                    ],
                };
            }
            await queryRunner.commitTransaction();
            return {
                success: true,
                data: savedCert,
                needsReview: false,
                message: '检疫证录入成功',
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('创建检疫证失败', error);
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async createDuplicateRecord(newCert, existingCert, user, queryRunner) {
        const conflictDetails = {
            newCertificate: {
                id: newCert.id,
                source: newCert.source,
                farmName: newCert.farmName,
                slaughterhouseName: newCert.slaughterhouseName,
                animalType: newCert.animalType,
                animalQuantity: newCert.animalQuantity,
                createdBy: newCert.issuerName,
                createdAt: newCert.createdAt,
            },
            existingCertificate: {
                id: existingCert.id,
                status: existingCert.status,
                source: existingCert.source,
                farmName: existingCert.farmName,
                slaughterhouseName: existingCert.slaughterhouseName,
                animalType: existingCert.animalType,
                animalQuantity: existingCert.animalQuantity,
                createdBy: existingCert.issuerName,
                createdAt: existingCert.createdAt,
            },
            differences: this.compareCertificates(newCert, existingCert),
        };
        const duplicate = (queryRunner?.manager || this.duplicateRepository).create(certificate_duplicate_entity_1.CertificateDuplicate, {
            certificateNumber: newCert.certificateNumber,
            certificateId: newCert.id,
            conflictingCertificateId: existingCert.id,
            status: types_1.ReviewStatus.PENDING,
            priority: types_1.ReviewPriority.HIGH,
            conflictReason: 'DUPLICATE_CERTIFICATE_NUMBER',
            conflictDetails,
            isPrimary: false,
        });
        return (queryRunner?.manager || this.duplicateRepository).save(certificate_duplicate_entity_1.CertificateDuplicate, duplicate);
    }
    compareCertificates(cert1, cert2) {
        const differences = {};
        const fields = ['source', 'farmName', 'slaughterhouseName', 'animalType', 'animalQuantity', 'totalWeight', 'slaughterDate', 'inspectionDate'];
        for (const field of fields) {
            if (String(cert1[field]) !== String(cert2[field])) {
                differences[field] = {
                    value1: cert1[field],
                    value2: cert2[field],
                };
            }
        }
        return differences;
    }
    async createReviewTaskForDuplicate(certificate, duplicateCount, user) {
        return {
            taskNumber: `REV-${Date.now()}`,
            certificateNumber: certificate.certificateNumber,
            certificateId: certificate.id,
            reasonCode: 'DUPLICATE_CERTIFICATE_NUMBER',
            reasonDescription: `证号 ${certificate.certificateNumber} 检测到 ${duplicateCount} 条重复记录，需要人工确认哪条是有效的`,
            priority: types_1.ReviewPriority.HIGH,
            status: types_1.ReviewStatus.PENDING,
            createdBy: user.userId,
            createdByName: user.userName,
        };
    }
    async findByNumber(certificateNumber) {
        return this.certificateRepository.find({
            where: { certificateNumber },
            order: { createdAt: 'DESC' },
        });
    }
    async findById(id) {
        const cert = await this.certificateRepository.findOne({ where: { id } });
        if (!cert) {
            throw new exceptions_1.CertificateNotFoundException(id);
        }
        return cert;
    }
    async getCertificateDetail(certificateNumber) {
        const certs = await this.findByNumber(certificateNumber);
        if (certs.length === 0) {
            throw new exceptions_1.CertificateNotFoundException(certificateNumber);
        }
        const primaryCert = certs[0];
        const flowHistory = await this.flowHistoryService.getCertificateFullTimeline(certificateNumber);
        const pendingDuplicates = await this.duplicateRepository.find({
            where: {
                certificateNumber,
                status: types_1.ReviewStatus.PENDING,
            },
        });
        return {
            success: true,
            data: {
                certificate: primaryCert,
                duplicates: certs.slice(1),
                flowHistory,
                hasDuplicate: certs.length > 1,
                needsManualReview: pendingDuplicates.length > 0,
            },
            needsReview: certs.length > 1 && pendingDuplicates.length > 0,
            message: certs.length > 1
                ? `查询成功，检测到 ${certs.length} 条重复记录，${pendingDuplicates.length} 条待复核`
                : '查询成功',
        };
    }
    async query(query) {
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const qb = this.certificateRepository.createQueryBuilder('cert');
        if (query.certificateNumber) {
            qb.andWhere('cert.certificateNumber LIKE :certNumber', {
                certNumber: `%${query.certificateNumber}%`,
            });
        }
        if (query.status?.length) {
            qb.andWhere('cert.status IN (:...status)', { status: query.status });
        }
        if (query.source?.length) {
            qb.andWhere('cert.source IN (:...source)', { source: query.source });
        }
        if (query.farmName) {
            qb.andWhere('cert.farmName LIKE :farmName', { farmName: `%${query.farmName}%` });
        }
        if (query.slaughterhouseName) {
            qb.andWhere('cert.slaughterhouseName LIKE :slaughterhouseName', {
                slaughterhouseName: `%${query.slaughterhouseName}%`,
            });
        }
        if (query.animalType) {
            qb.andWhere('cert.animalType = :animalType', { animalType: query.animalType });
        }
        if (query.hasDuplicate !== undefined) {
            qb.andWhere('cert.hasDuplicate = :hasDuplicate', { hasDuplicate: query.hasDuplicate });
        }
        if (query.hasManualCorrection !== undefined) {
            qb.andWhere('cert.hasManualCorrection = :hasManualCorrection', {
                hasManualCorrection: query.hasManualCorrection,
            });
        }
        if (query.startDate) {
            qb.andWhere('cert.createdAt >= :startDate', { startDate: query.startDate });
        }
        if (query.endDate) {
            qb.andWhere('cert.createdAt <= :endDate', { endDate: query.endDate });
        }
        const [items, total] = await qb
            .orderBy('cert.createdAt', 'DESC')
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
    async updateStatus(certificateId, newStatus, user, options) {
        const certificate = await this.findById(certificateId);
        if (certificate.status === types_1.CertificateStatus.VOIDED && newStatus !== types_1.CertificateStatus.MANUALLY_CORRECTED) {
            throw new exceptions_1.CertificateAlreadyVoidedException(certificate.certificateNumber);
        }
        if (!this.VALID_STATUS_TRANSITIONS[certificate.status]?.includes(newStatus)) {
            throw new exceptions_1.InvalidStatusTransitionException(certificate.status, newStatus, `不允许从 ${certificate.status} 转换到 ${newStatus}`);
        }
        const oldStatus = certificate.status;
        certificate.status = newStatus;
        certificate.lastOperatorId = user.userId;
        certificate.lastOperatorName = user.userName;
        if (options?.isManualCorrection) {
            certificate.hasManualCorrection = true;
        }
        const savedCert = await this.certificateRepository.save(certificate);
        await this.flowHistoryService.recordAction({
            certificateNumber: savedCert.certificateNumber,
            certificateId: savedCert.id,
            action: options?.action || types_1.FlowAction.MANUAL_CORRECTION,
            description: options?.actionDescription || `状态变更: ${oldStatus} -> ${newStatus}`,
            previousStatus: oldStatus,
            newStatus: newStatus,
            user,
            relatedEntityId: options?.relatedEntityId,
            relatedEntityType: options?.relatedEntityType,
            isManualCorrection: options?.isManualCorrection || false,
            correctionReason: options?.reason,
        });
        await this.auditLogService.log({
            entityType: types_1.EntityType.CERTIFICATE,
            entityId: certificateId,
            entityNumber: certificate.certificateNumber,
            action: 'STATUS_UPDATE',
            description: `状态变更: ${oldStatus} -> ${newStatus}`,
            user,
            beforeData: { status: oldStatus },
            afterData: { status: newStatus },
            remarks: options?.reason,
        });
        return {
            success: true,
            data: savedCert,
            needsReview: false,
            message: '状态更新成功',
        };
    }
    async manualCorrection(certificateId, dto, user) {
        const certificate = await this.findById(certificateId);
        const beforeData = { ...certificate };
        const changes = {};
        if (dto.status && dto.status !== certificate.status) {
            if (!this.VALID_STATUS_TRANSITIONS[certificate.status]?.includes(dto.status)) {
                if (!dto.skipDuplicateCheck) {
                    throw new exceptions_1.InvalidStatusTransitionException(certificate.status, dto.status, '人工修正状态需要确认，请设置 skipDuplicateCheck=true');
                }
            }
            changes['status'] = { from: certificate.status, to: dto.status };
            certificate.status = dto.status;
        }
        if (dto.fields) {
            for (const [key, value] of Object.entries(dto.fields)) {
                if (certificate[key] !== undefined) {
                    changes[key] = { from: certificate[key], to: value };
                    certificate[key] = value;
                }
            }
        }
        certificate.hasManualCorrection = true;
        certificate.lastOperatorId = user.userId;
        certificate.lastOperatorName = user.userName;
        const savedCert = await this.certificateRepository.save(certificate);
        await this.flowHistoryService.recordAction({
            certificateNumber: savedCert.certificateNumber,
            certificateId: savedCert.id,
            action: types_1.FlowAction.MANUAL_CORRECTION,
            description: `人工修正: ${dto.reason}`,
            previousStatus: beforeData.status,
            newStatus: savedCert.status,
            user,
            changes,
            snapshot: beforeData,
            isManualCorrection: true,
            correctionReason: dto.reason,
        });
        await this.auditLogService.log({
            entityType: types_1.EntityType.CERTIFICATE,
            entityId: certificateId,
            entityNumber: certificate.certificateNumber,
            action: 'MANUAL_CORRECTION',
            description: `人工修正: ${dto.reason}`,
            user,
            beforeData,
            afterData: { ...savedCert },
            remarks: dto.reason,
        });
        return {
            success: true,
            data: savedCert,
            needsReview: false,
            message: '人工修正已记录，历史数据已保存，后续统计将基于修正后的状态',
            warnings: [
                '已记录人工修正操作',
                '所有历史记录已保留，可追溯原始状态',
                '后续统计将使用当前修正后的状态',
            ],
        };
    }
    async getStatistics() {
        const [total, statusStats, sourceStats, duplicates, manualCorrected] = await Promise.all([
            this.certificateRepository.count(),
            this.certificateRepository
                .createQueryBuilder('cert')
                .select('cert.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .groupBy('cert.status')
                .getRawMany(),
            this.certificateRepository
                .createQueryBuilder('cert')
                .select('cert.source', 'source')
                .addSelect('COUNT(*)', 'count')
                .groupBy('cert.source')
                .getRawMany(),
            this.certificateRepository.count({ where: { hasDuplicate: true } }),
            this.certificateRepository.count({ where: { hasManualCorrection: true } }),
        ]);
        return {
            total,
            byStatus: statusStats.reduce((acc, item) => ({ ...acc, [item.status]: Number(item.count) }), {}),
            bySource: sourceStats.reduce((acc, item) => ({ ...acc, [item.source]: Number(item.count) }), {}),
            duplicates,
            manuallyCorrected: manualCorrected,
        };
    }
};
exports.CertificateService = CertificateService;
exports.CertificateService = CertificateService = CertificateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(certificate_entity_1.Certificate)),
    __param(1, (0, typeorm_1.InjectRepository)(certificate_duplicate_entity_1.CertificateDuplicate)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        flow_history_service_1.FlowHistoryService,
        audit_log_service_1.AuditLogService])
], CertificateService);
//# sourceMappingURL=certificate.service.js.map