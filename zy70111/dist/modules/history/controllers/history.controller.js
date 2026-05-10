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
exports.HistoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const flow_history_service_1 = require("../services/flow-history.service");
const audit_log_service_1 = require("../services/audit-log.service");
let HistoryController = class HistoryController {
    constructor(flowHistoryService, auditLogService) {
        this.flowHistoryService = flowHistoryService;
        this.auditLogService = auditLogService;
    }
    async getFlowHistory(certificateNumber) {
        return this.flowHistoryService.getCertificateFullTimeline(certificateNumber);
    }
    async getFlowHistoryById(certificateId) {
        return this.flowHistoryService.findByCertificateId(certificateId);
    }
    async getManualCorrectionHistory(certificateId) {
        return this.flowHistoryService.findManualCorrectionHistory(certificateId);
    }
    async getEntityAuditLog(entityType, entityId) {
        return this.auditLogService.findByEntity(entityType, entityId);
    }
};
exports.HistoryController = HistoryController;
__decorate([
    (0, common_1.Get)('flow/:certificateNumber'),
    (0, swagger_1.ApiOperation)({ summary: '查询检疫证流转历史' }),
    (0, swagger_1.ApiParam)({ name: 'certificateNumber', description: '检疫证号' }),
    __param(0, (0, common_1.Param)('certificateNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getFlowHistory", null);
__decorate([
    (0, common_1.Get)('flow/id/:certificateId'),
    (0, swagger_1.ApiOperation)({ summary: '通过ID查询检疫证流转历史' }),
    (0, swagger_1.ApiParam)({ name: 'certificateId', description: '检疫证ID' }),
    __param(0, (0, common_1.Param)('certificateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getFlowHistoryById", null);
__decorate([
    (0, common_1.Get)('manual-correction/:certificateId'),
    (0, swagger_1.ApiOperation)({ summary: '查询人工修正历史' }),
    (0, swagger_1.ApiParam)({ name: 'certificateId', description: '检疫证ID' }),
    __param(0, (0, common_1.Param)('certificateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getManualCorrectionHistory", null);
__decorate([
    (0, common_1.Get)('audit/entity/:entityType/:entityId'),
    (0, swagger_1.ApiOperation)({ summary: '查询实体审计日志' }),
    (0, swagger_1.ApiParam)({ name: 'entityType', description: '实体类型' }),
    (0, swagger_1.ApiParam)({ name: 'entityId', description: '实体ID' }),
    __param(0, (0, common_1.Param)('entityType')),
    __param(1, (0, common_1.Param)('entityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getEntityAuditLog", null);
exports.HistoryController = HistoryController = __decorate([
    (0, swagger_1.ApiTags)('历史记录'),
    (0, common_1.Controller)('history'),
    __metadata("design:paramtypes", [flow_history_service_1.FlowHistoryService,
        audit_log_service_1.AuditLogService])
], HistoryController);
//# sourceMappingURL=history.controller.js.map