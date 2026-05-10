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
var VoidService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoidService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const void_record_entity_1 = require("../entities/void-record.entity");
const certificate_entity_1 = require("../../certificate/entities/certificate.entity");
const types_1 = require("../../../common/types");
const exceptions_1 = require("../../../common/exceptions");
const certificate_service_1 = require("../../certificate/services/certificate.service");
const flow_history_service_1 = require("../../history/services/flow-history.service");
const audit_log_service_1 = require("../../history/services/audit-log.service");
let VoidService = VoidService_1 = class VoidService {
    constructor(voidRepository, certificateRepository, dataSource, certificateService, flowHistoryService, auditLogService) {
        this.voidRepository = voidRepository;
        this.certificateRepository = certificateRepository;
        this.dataSource = dataSource;
        this.certificateService = certificateService;
        this.flowHistoryService = flowHistoryService;
        this.auditLogService = auditLogService;
        this.logger = new common_1.Logger(VoidService_1.name);
    }
    async voidCertificate(dto, user) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const certificate = await this.certificateRepository.findOne({
                where: { id: dto.certificateId },
            });
            if (!certificate) {
                throw new exceptions_1.CertificateNotFoundException(dto.certificateId);
            }
            if (certificate.status === types_1.CertificateStatus.VOIDED) {
                throw new exceptions_1.CertificateAlreadyVoidedException(certificate.certificateNumber);
            }
            const oldStatus = certificate.status;
            await this.certificateService.updateStatus(certificate.id, types_1.CertificateStatus.VOIDED, user, {
                action: types_1.FlowAction.CERTIFICATE_VOIDED,
                actionDescription: `作废原因: ${dto.reason} - ${dto.reasonDetails}`,
                reason: dto.reasonDetails,
            });
            let reissuedCertificate;
            if (dto.shouldReissue && dto.newCertificateNumber) {
                reissuedCertificate = await this.internalReissue(certificate, dto.newCertificateNumber, user, queryRunner);
            }
            const voidRecord = this.voidRepository.create({
                certificateNumber: certificate.certificateNumber,
                certificateId: certificate.id,
                reason: dto.reason,
                reasonDetails: dto.reasonDetails,
                isReissued: !!reissuedCertificate,
                reissuedCertificateId: reissuedCertificate?.id,
                reissuedCertificateNumber: reissuedCertificate?.certificateNumber,
                requestedBy: user.userId,
                requestedByName: user.userName,
                approvedBy: user.userId,
                approvedByName: user.userName,
                approvedAt: new Date(),
                remarks: dto.remarks,
            });
            const savedVoidRecord = await queryRunner.manager.save(void_record_entity_1.VoidRecord, voidRecord);
            await this.auditLogService.log({
                entityType: types_1.EntityType.VOID_RECORD,
                entityId: savedVoidRecord.id,
                entityNumber: certificate.certificateNumber,
                action: 'VOID',
                description: `作废检疫证: ${certificate.certificateNumber}`,
                user,
                beforeData: { status: oldStatus },
                afterData: { status: types_1.CertificateStatus.VOIDED },
                requestData: dto,
            });
            await queryRunner.commitTransaction();
            return {
                success: true,
                data: {
                    voidRecord: savedVoidRecord,
                    certificate,
                    reissuedCertificate,
                },
                needsReview: false,
                message: reissuedCertificate
                    ? `检疫证已作废，并重新开具新证 ${reissuedCertificate.certificateNumber}`
                    : `检疫证 ${certificate.certificateNumber} 已作废`,
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
    async internalReissue(originalCert, newNumber, user, queryRunner) {
        const existingCerts = await this.certificateRepository.find({
            where: { certificateNumber: newNumber },
        });
        if (existingCerts.length > 0) {
            throw new Error(`新证号 ${newNumber} 已存在，请使用唯一证号`);
        }
        const newCert = queryRunner.manager.create(certificate_entity_1.Certificate, {
            certificateNumber: newNumber,
            status: types_1.CertificateStatus.ISSUED,
            source: originalCert.source,
            farmName: originalCert.farmName,
            farmId: originalCert.farmId,
            slaughterhouseName: originalCert.slaughterhouseName,
            slaughterhouseId: originalCert.slaughterhouseId,
            animalType: originalCert.animalType,
            animalQuantity: originalCert.animalQuantity,
            totalWeight: originalCert.totalWeight,
            slaughterDate: originalCert.slaughterDate,
            inspectionDate: originalCert.inspectionDate,
            inspectorName: originalCert.inspectorName,
            issuerId: user.userId,
            issuerName: user.userName,
            originalCertificateId: originalCert.id,
            hasDuplicate: false,
            hasManualCorrection: false,
            remarks: `重开证，原始证号: ${originalCert.certificateNumber}`,
            metadata: {
                ...originalCert.metadata,
                isReissued: true,
                originalCertificateId: originalCert.id,
                originalCertificateNumber: originalCert.certificateNumber,
            },
            lastOperatorId: user.userId,
            lastOperatorName: user.userName,
        });
        const savedNewCert = await queryRunner.manager.save(certificate_entity_1.Certificate, newCert);
        originalCert.reissuedCertificateId = savedNewCert.id;
        await queryRunner.manager.save(certificate_entity_1.Certificate, originalCert);
        await this.flowHistoryService.recordAction({
            certificateNumber: savedNewCert.certificateNumber,
            certificateId: savedNewCert.id,
            action: types_1.FlowAction.CERTIFICATE_REISSUED,
            description: `重新开具检疫证，原始证号: ${originalCert.certificateNumber}`,
            previousStatus: null,
            newStatus: types_1.CertificateStatus.ISSUED,
            user,
            relatedEntityId: originalCert.id,
            relatedEntityType: 'certificate',
        });
        return savedNewCert;
    }
    async reissueCertificate(dto, user) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const originalCert = await this.certificateRepository.findOne({
                where: { id: dto.originalCertificateId },
            });
            if (!originalCert) {
                throw new exceptions_1.CertificateNotFoundException(dto.originalCertificateId);
            }
            const existingCerts = await this.certificateRepository.find({
                where: { certificateNumber: dto.newCertificateNumber },
            });
            if (existingCerts.length > 0) {
                throw new Error(`新证号 ${dto.newCertificateNumber} 已存在，请使用唯一证号`);
            }
            const newCert = await this.internalReissue(originalCert, dto.newCertificateNumber, user, queryRunner);
            await this.auditLogService.log({
                entityType: types_1.EntityType.CERTIFICATE,
                entityId: newCert.id,
                entityNumber: newCert.certificateNumber,
                action: 'REISSUE',
                description: `重开证: 原始证 ${originalCert.certificateNumber} -> 新证 ${newCert.certificateNumber}`,
                user,
                requestData: dto,
            });
            await queryRunner.commitTransaction();
            return {
                success: true,
                data: {
                    originalCertificate: originalCert,
                    newCertificate: newCert,
                },
                needsReview: existingCerts.length > 0,
                message: `已成功重开新证 ${newCert.certificateNumber}`,
                warnings: [`原始证号: ${originalCert.certificateNumber}`],
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
    async findByCertificateId(certificateId) {
        return this.voidRepository.find({
            where: { certificateId },
            order: { createdAt: 'DESC' },
        });
    }
    async findByCertificateNumber(certificateNumber) {
        return this.voidRepository.find({
            where: { certificateNumber },
            order: { createdAt: 'DESC' },
        });
    }
};
exports.VoidService = VoidService;
exports.VoidService = VoidService = VoidService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(void_record_entity_1.VoidRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(certificate_entity_1.Certificate)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        certificate_service_1.CertificateService,
        flow_history_service_1.FlowHistoryService,
        audit_log_service_1.AuditLogService])
], VoidService);
//# sourceMappingURL=void.service.js.map