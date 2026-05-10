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
exports.FlowHistoryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const flow_history_entity_1 = require("../entities/flow-history.entity");
let FlowHistoryService = class FlowHistoryService {
    constructor(flowHistoryRepository) {
        this.flowHistoryRepository = flowHistoryRepository;
    }
    async recordAction(params) {
        const history = this.flowHistoryRepository.create({
            certificateNumber: params.certificateNumber,
            certificateId: params.certificateId,
            action: params.action,
            description: params.description,
            previousStatus: params.previousStatus,
            newStatus: params.newStatus,
            operatorId: params.user.userId,
            operatorName: params.user.userName,
            sourceSystem: params.user.source,
            changes: params.changes ? JSON.stringify(params.changes) : null,
            snapshot: params.snapshot ? JSON.stringify(params.snapshot) : null,
            relatedEntityId: params.relatedEntityId,
            relatedEntityType: params.relatedEntityType,
            isManualCorrection: params.isManualCorrection || false,
            correctionReason: params.correctionReason,
        });
        return this.flowHistoryRepository.save(history);
    }
    async findByCertificateNumber(certificateNumber) {
        return this.flowHistoryRepository.find({
            where: { certificateNumber },
            order: { createdAt: 'DESC' },
        });
    }
    async findByCertificateId(certificateId) {
        return this.flowHistoryRepository.find({
            where: { certificateId },
            order: { createdAt: 'DESC' },
        });
    }
    async findByRelatedEntity(relatedEntityType, relatedEntityId) {
        return this.flowHistoryRepository.find({
            where: { relatedEntityType, relatedEntityId },
            order: { createdAt: 'DESC' },
        });
    }
    async findManualCorrectionHistory(certificateId) {
        return this.flowHistoryRepository.find({
            where: { certificateId, isManualCorrection: true },
            order: { createdAt: 'DESC' },
        });
    }
    async getCertificateFullTimeline(certificateNumber) {
        const histories = await this.findByCertificateNumber(certificateNumber);
        const statusChanges = histories
            .filter((h) => h.previousStatus && h.newStatus && h.previousStatus !== h.newStatus)
            .map((h) => ({
            from: h.previousStatus,
            to: h.newStatus,
            action: h.action,
            operator: h.operatorName,
            time: h.createdAt,
        }));
        const manualCorrections = histories.filter((h) => h.isManualCorrection);
        return {
            histories,
            statusChanges,
            hasManualCorrection: manualCorrections.length > 0,
            lastManualCorrection: manualCorrections[0] || undefined,
        };
    }
    async getStatistics(certificateIds) {
        const histories = await this.flowHistoryRepository.find({
            where: { certificateId: (0, typeorm_2.In)(certificateIds) },
        });
        const actionBreakdown = {};
        let manualCorrections = 0;
        histories.forEach((h) => {
            actionBreakdown[h.action] = (actionBreakdown[h.action] || 0) + 1;
            if (h.isManualCorrection)
                manualCorrections++;
        });
        return {
            totalActions: histories.length,
            manualCorrections,
            actionBreakdown,
        };
    }
};
exports.FlowHistoryService = FlowHistoryService;
exports.FlowHistoryService = FlowHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(flow_history_entity_1.FlowHistory)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], FlowHistoryService);
//# sourceMappingURL=flow-history.service.js.map