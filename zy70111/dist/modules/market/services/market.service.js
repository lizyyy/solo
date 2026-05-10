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
var MarketService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const market_inspection_entity_1 = require("../entities/market-inspection.entity");
const certificate_entity_1 = require("../../certificate/entities/certificate.entity");
const types_1 = require("../../../common/types");
const exceptions_1 = require("../../../common/exceptions");
const certificate_service_1 = require("../../certificate/services/certificate.service");
const flow_history_service_1 = require("../../history/services/flow-history.service");
const audit_log_service_1 = require("../../history/services/audit-log.service");
let MarketService = MarketService_1 = class MarketService {
    constructor(inspectionRepository, certificateRepository, dataSource, certificateService, flowHistoryService, auditLogService) {
        this.inspectionRepository = inspectionRepository;
        this.certificateRepository = certificateRepository;
        this.dataSource = dataSource;
        this.certificateService = certificateService;
        this.flowHistoryService = flowHistoryService;
        this.auditLogService = auditLogService;
        this.logger = new common_1.Logger(MarketService_1.name);
    }
    async inspect(dto, user) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const warnings = [];
            let certificate;
            const certs = await this.certificateRepository.find({
                where: { certificateNumber: dto.certificateNumber },
                order: { createdAt: 'DESC' },
            });
            if (certs.length > 1) {
                warnings.push(`检测到证号 ${dto.certificateNumber} 有 ${certs.length} 条重复记录，请人工核验`);
            }
            if (dto.certificateId) {
                certificate = certs.find((c) => c.id === dto.certificateId);
            }
            if (!certificate && certs.length > 0) {
                certificate = certs[0];
                warnings.push(`未指定具体ID，默认使用最新记录: ${certificate.id}`);
            }
            const inspection = this.inspectionRepository.create({
                ...dto,
                certificateId: certificate?.id,
                inspectorId: user.userId,
                inspectorName: user.userName,
            });
            const savedInspection = await queryRunner.manager.save(market_inspection_entity_1.MarketInspection, inspection);
            if (certificate) {
                if (certificate.hasDuplicate) {
                    warnings.push(`证号 ${dto.certificateNumber} 存在重复标记，建议结合纸质证和系统信息确认`);
                }
                if (dto.result === types_1.MarketInspectionResult.ACCEPTED) {
                    if (certificate.status !== types_1.CertificateStatus.TRANSPORT_VERIFIED &&
                        certificate.status !== types_1.CertificateStatus.IN_TRANSPORT) {
                        throw new exceptions_1.InvalidStatusTransitionException(certificate.status, types_1.CertificateStatus.MARKET_ACCEPTED, `检疫证状态为 ${certificate.status}，无法直接验收，请先确认运输状态`);
                    }
                    await this.certificateService.updateStatus(certificate.id, types_1.CertificateStatus.MARKET_ACCEPTED, user, {
                        action: types_1.FlowAction.MARKET_ACCEPTED,
                        actionDescription: `市场验收通过: ${dto.marketName}，经营户: ${dto.merchantName}`,
                        relatedEntityId: savedInspection.id,
                        relatedEntityType: 'market_inspection',
                    });
                    if (certificate.inspectionDate) {
                        const certDate = new Date(certificate.inspectionDate);
                        const inspectDate = new Date(dto.inspectedAt);
                        const diffDays = Math.floor((inspectDate.getTime() - certDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays > 7) {
                            warnings.push(`检疫证已超过7天有效期（签发${diffDays}天），建议确认是否在有效期内使用`);
                        }
                    }
                    if (certificate.animalQuantity !== dto.inspectedQuantity) {
                        warnings.push(`验收数量与证载数量不一致: 证载${certificate.animalQuantity}，验收${dto.inspectedQuantity}`);
                    }
                }
                else if (dto.result === types_1.MarketInspectionResult.NEEDS_REVIEW) {
                    warnings.push(`验收结果为需复核，已标记待人工处理`);
                }
            }
            else {
                warnings.push(`未在系统中找到证号 ${dto.certificateNumber} 的记录，已保存验收记录但未更新检疫证状态`);
            }
            await this.auditLogService.log({
                entityType: types_1.EntityType.MARKET_INSPECTION,
                entityId: savedInspection.id,
                entityNumber: dto.certificateNumber,
                action: 'INSPECT',
                description: `市场验收: ${dto.result}`,
                user,
                afterData: { ...savedInspection },
                requestData: dto,
            });
            await queryRunner.commitTransaction();
            const needsReview = certs.length > 1 ||
                dto.result === types_1.MarketInspectionResult.NEEDS_REVIEW ||
                !certificate;
            return {
                success: true,
                data: {
                    inspection: savedInspection,
                    certificate,
                    warnings,
                },
                needsReview,
                reviewReason: needsReview
                    ? certs.length > 1
                        ? 'MARKET_INSPECTION_DUPLICATE_CERT'
                        : !certificate
                            ? 'MARKET_INSPECTION_CERT_NOT_FOUND'
                            : 'MARKET_INSPECTION_NEEDS_REVIEW'
                    : undefined,
                reviewPriority: needsReview ? types_1.ReviewPriority.HIGH : undefined,
                message: needsReview
                    ? `验收记录已保存，但存在需要人工复核的情况`
                    : '市场验收完成',
                warnings,
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
    async query(query) {
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const qb = this.inspectionRepository.createQueryBuilder('inspection');
        if (query.certificateNumber) {
            qb.andWhere('inspection.certificateNumber LIKE :certNumber', {
                certNumber: `%${query.certificateNumber}%`,
            });
        }
        if (query.result?.length) {
            qb.andWhere('inspection.result IN (:...result)', { result: query.result });
        }
        if (query.marketName) {
            qb.andWhere('inspection.marketName LIKE :marketName', {
                marketName: `%${query.marketName}%`,
            });
        }
        if (query.merchantName) {
            qb.andWhere('inspection.merchantName LIKE :merchantName', {
                merchantName: `%${query.merchantName}%`,
            });
        }
        if (query.startDate) {
            qb.andWhere('inspection.inspectedAt >= :startDate', { startDate: query.startDate });
        }
        if (query.endDate) {
            qb.andWhere('inspection.inspectedAt <= :endDate', { endDate: query.endDate });
        }
        const [items, total] = await qb
            .orderBy('inspection.inspectedAt', 'DESC')
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
    async findById(id) {
        const inspection = await this.inspectionRepository.findOne({ where: { id } });
        if (!inspection) {
            throw new Error('验收记录不存在');
        }
        return inspection;
    }
};
exports.MarketService = MarketService;
exports.MarketService = MarketService = MarketService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(market_inspection_entity_1.MarketInspection)),
    __param(1, (0, typeorm_1.InjectRepository)(certificate_entity_1.Certificate)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        certificate_service_1.CertificateService,
        flow_history_service_1.FlowHistoryService,
        audit_log_service_1.AuditLogService])
], MarketService);
//# sourceMappingURL=market.service.js.map