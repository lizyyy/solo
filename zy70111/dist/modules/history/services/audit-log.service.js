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
exports.AuditLogService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("../entities/audit-log.entity");
let AuditLogService = class AuditLogService {
    constructor(auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }
    async log(params) {
        const log = this.auditLogRepository.create({
            entityType: params.entityType,
            entityId: params.entityId,
            entityNumber: params.entityNumber,
            action: params.action,
            description: params.description,
            operatorId: params.user.userId,
            operatorName: params.user.userName,
            operatorRole: params.user.role,
            sourceIp: params.sourceIp || 'unknown',
            userAgent: params.userAgent,
            beforeData: params.beforeData,
            afterData: params.afterData,
            requestData: params.requestData,
            remarks: params.remarks,
        });
        return this.auditLogRepository.save(log);
    }
    async findByEntity(entityType, entityId) {
        return this.auditLogRepository.find({
            where: { entityType, entityId },
            order: { createdAt: 'DESC' },
        });
    }
    async findByOperator(operatorId) {
        return this.auditLogRepository.find({
            where: { operatorId },
            order: { createdAt: 'DESC' },
        });
    }
    async findByTimeRange(startTime, endTime) {
        return this.auditLogRepository
            .createQueryBuilder('log')
            .where('log.createdAt >= :startTime', { startTime })
            .andWhere('log.createdAt <= :endTime', { endTime })
            .orderBy('log.createdAt', 'DESC')
            .getMany();
    }
};
exports.AuditLogService = AuditLogService;
exports.AuditLogService = AuditLogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuditLogService);
//# sourceMappingURL=audit-log.service.js.map