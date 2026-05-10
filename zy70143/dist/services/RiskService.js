"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskService = void 0;
const RiskItem_1 = require("../entities/RiskItem");
const types_1 = require("../types");
const logger_1 = require("../logger");
const logger = (0, logger_1.createAuditLogger)('RiskService');
class RiskService {
    constructor(riskItemRepo, vulnerabilityRepo) {
        this.riskItemRepo = riskItemRepo;
        this.vulnerabilityRepo = vulnerabilityRepo;
    }
    async createRiskItem(data) {
        logger.info('创建风险项', { title: data.title, level: data.level });
        if (data.vulnerabilityId) {
            const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: data.vulnerabilityId } });
            if (!vulnerability) {
                throw new Error(`关联的漏洞 ${data.vulnerabilityId} 不存在`);
            }
        }
        const riskItem = this.riskItemRepo.create({
            ...data,
            status: RiskItem_1.RiskStatus.OPEN
        });
        const saved = await this.riskItemRepo.save(riskItem);
        logger.info('风险项创建成功', { riskId: saved.id });
        return saved;
    }
    async getRiskItem(id) {
        return this.riskItemRepo.findOne({ where: { id } });
    }
    async listRiskItems(filters) {
        const where = {};
        if (filters?.status)
            where.status = filters.status;
        if (filters?.level)
            where.level = filters.level;
        if (filters?.vulnerabilityId)
            where.vulnerabilityId = filters.vulnerabilityId;
        if (filters?.ownerId)
            where.ownerId = filters.ownerId;
        return this.riskItemRepo.find({
            where,
            order: {
                level: 'DESC',
                createdAt: 'DESC'
            }
        });
    }
    async updateRiskStatus(riskId, newStatus, resolutionNote, operatorId, operatorName) {
        logger.info('更新风险项状态', { riskId, newStatus });
        const riskItem = await this.getRiskItem(riskId);
        if (!riskItem) {
            throw new Error(`风险项 ${riskId} 不存在`);
        }
        if (riskItem.status === newStatus) {
            return riskItem;
        }
        riskItem.status = newStatus;
        if (resolutionNote) {
            riskItem.resolutionNote = resolutionNote;
        }
        if (operatorId) {
            riskItem.ownerId = operatorId;
        }
        if (operatorName) {
            riskItem.ownerName = operatorName;
        }
        if (newStatus === RiskItem_1.RiskStatus.MITIGATED || newStatus === RiskItem_1.RiskStatus.CLOSED || newStatus === RiskItem_1.RiskStatus.ACCEPTED) {
            riskItem.resolvedAt = new Date();
        }
        const saved = await this.riskItemRepo.save(riskItem);
        logger.info('风险项状态更新成功', { riskId, from: riskItem.status, to: newStatus });
        return saved;
    }
    async getRiskDashboard() {
        const allRisks = await this.riskItemRepo.find();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const byLevel = {
            [types_1.RiskLevel.EXTREME]: 0,
            [types_1.RiskLevel.HIGH]: 0,
            [types_1.RiskLevel.MEDIUM]: 0,
            [types_1.RiskLevel.LOW]: 0
        };
        const byStatus = {
            [RiskItem_1.RiskStatus.OPEN]: 0,
            [RiskItem_1.RiskStatus.MITIGATED]: 0,
            [RiskItem_1.RiskStatus.ACCEPTED]: 0,
            [RiskItem_1.RiskStatus.CLOSED]: 0
        };
        let overdue = 0;
        for (const r of allRisks) {
            byLevel[r.level]++;
            byStatus[r.status]++;
            if (r.dueDate && r.dueDate < today && r.status === RiskItem_1.RiskStatus.OPEN) {
                overdue++;
            }
        }
        const levelPriority = {
            [types_1.RiskLevel.EXTREME]: 4,
            [types_1.RiskLevel.HIGH]: 3,
            [types_1.RiskLevel.MEDIUM]: 2,
            [types_1.RiskLevel.LOW]: 1
        };
        const topRisks = allRisks
            .filter(r => r.status === RiskItem_1.RiskStatus.OPEN)
            .sort((a, b) => {
            const levelDiff = levelPriority[b.level] - levelPriority[a.level];
            if (levelDiff !== 0)
                return levelDiff;
            return (a.dueDate?.getTime() || Infinity) - (b.dueDate?.getTime() || Infinity);
        })
            .slice(0, 10);
        const recentlyAdded = allRisks
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 5);
        return {
            summary: {
                total: allRisks.length,
                byLevel,
                byStatus,
                overdue
            },
            topRisks,
            recentlyAdded
        };
    }
}
exports.RiskService = RiskService;
//# sourceMappingURL=RiskService.js.map