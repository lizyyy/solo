"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchService = void 0;
const UpgradeTask_1 = require("../entities/UpgradeTask");
const types_1 = require("../types");
const BusinessRuleValidator_1 = require("./BusinessRuleValidator");
const logger_1 = require("../logger");
const logger = (0, logger_1.createAuditLogger)('BatchService');
class BatchService {
    constructor(batchRepo, vulnerabilityRepo, upgradeTaskRepo) {
        this.batchRepo = batchRepo;
        this.vulnerabilityRepo = vulnerabilityRepo;
        this.upgradeTaskRepo = upgradeTaskRepo;
    }
    async createBatch(data) {
        logger.info('创建批次', { code: data.code, name: data.name });
        const existing = await this.batchRepo.findOne({ where: { code: data.code } });
        if (existing) {
            throw new Error(`批次编码 ${data.code} 已存在`);
        }
        const batch = this.batchRepo.create({
            ...data,
            status: types_1.BatchStatus.PLANNED
        });
        const saved = await this.batchRepo.save(batch);
        logger.info('批次创建成功', { batchId: saved.id, code: data.code });
        return saved;
    }
    async getBatch(id) {
        return this.batchRepo.findOne({ where: { id } });
    }
    async listBatches(status) {
        const where = {};
        if (status)
            where.status = status;
        return this.batchRepo.find({
            where,
            order: { plannedDate: 'ASC' }
        });
    }
    async addVulnerabilityToBatch(batchId, vulnerabilityId) {
        logger.info('将漏洞加入批次', { batchId, vulnerabilityId });
        const batch = await this.getBatch(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        if (batch.status === types_1.BatchStatus.DEPLOYED) {
            throw new Error('已上线的批次不能再添加漏洞');
        }
        const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: vulnerabilityId } });
        if (!vulnerability) {
            throw new Error(`漏洞 ${vulnerabilityId} 不存在`);
        }
        if (vulnerability.batchId) {
            throw new Error(`漏洞已在批次 ${vulnerability.batchId} 中，不能重复加入`);
        }
        vulnerability.batchId = batchId;
        await this.vulnerabilityRepo.save(vulnerability);
        logger.info('漏洞已加入批次', { vulnerabilityId, batchId });
    }
    async getBatchVulnerabilities(batchId) {
        return this.vulnerabilityRepo.find({
            where: { batchId },
            order: { severity: 'DESC', createdAt: 'ASC' }
        });
    }
    async checkBatchHealth(batchId) {
        const batch = await this.getBatch(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const vulnerabilities = await this.getBatchVulnerabilities(batchId);
        const consistency = BusinessRuleValidator_1.BusinessRuleValidator.checkBatchConsistency(batch.status, vulnerabilities);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const byStatus = {
            [types_1.VulnerabilityStatus.NEW]: 0,
            [types_1.VulnerabilityStatus.ASSIGNED]: 0,
            [types_1.VulnerabilityStatus.IN_PROGRESS]: 0,
            [types_1.VulnerabilityStatus.DELAYED]: 0,
            [types_1.VulnerabilityStatus.FIXED]: 0,
            [types_1.VulnerabilityStatus.DEPLOYED]: 0,
            [types_1.VulnerabilityStatus.CLOSED]: 0
        };
        let overdue = 0;
        for (const v of vulnerabilities) {
            byStatus[v.status]++;
            if (v.dueDate && v.dueDate < today && v.status !== types_1.VulnerabilityStatus.CLOSED && v.status !== types_1.VulnerabilityStatus.DEPLOYED) {
                overdue++;
            }
        }
        return {
            batch,
            vulnerabilities,
            consistent: consistency.consistent,
            issues: consistency.issues,
            summary: {
                total: vulnerabilities.length,
                byStatus,
                overdue
            }
        };
    }
    async deployBatch(batchId, deployedAt = new Date()) {
        logger.info('上线批次', { batchId });
        const health = await this.checkBatchHealth(batchId);
        if (!health.consistent) {
            logger.warn('批次一致性检查失败', { batchId, issues: health.issues });
        }
        const uncompleted = health.vulnerabilities.filter(v => v.status !== types_1.VulnerabilityStatus.FIXED && v.status !== types_1.VulnerabilityStatus.DEPLOYED && v.status !== types_1.VulnerabilityStatus.CLOSED);
        if (uncompleted.length > 0) {
            throw new Error(`批次中有 ${uncompleted.length} 个漏洞未修复，不能上线`);
        }
        const batch = health.batch;
        batch.status = types_1.BatchStatus.DEPLOYED;
        batch.deployedAt = deployedAt;
        const saved = await this.batchRepo.save(batch);
        for (const v of health.vulnerabilities) {
            if (v.status === types_1.VulnerabilityStatus.FIXED) {
                v.status = types_1.VulnerabilityStatus.DEPLOYED;
                await this.vulnerabilityRepo.save(v);
            }
        }
        logger.info('批次上线成功', { batchId, deployedAt });
        return saved;
    }
    async createUpgradeTask(data) {
        logger.info('创建升级任务', { vulnerabilityId: data.vulnerabilityId, title: data.title });
        const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: data.vulnerabilityId } });
        if (!vulnerability) {
            throw new Error(`漏洞 ${data.vulnerabilityId} 不存在`);
        }
        const task = this.upgradeTaskRepo.create({
            ...data,
            status: UpgradeTask_1.TaskStatus.PENDING
        });
        const saved = await this.upgradeTaskRepo.save(task);
        if (vulnerability.status === types_1.VulnerabilityStatus.ASSIGNED) {
            vulnerability.status = types_1.VulnerabilityStatus.IN_PROGRESS;
            await this.vulnerabilityRepo.save(vulnerability);
        }
        logger.info('升级任务创建成功', { taskId: saved.id });
        return saved;
    }
    async getUpgradeTasks(vulnerabilityId, status) {
        const where = {};
        if (vulnerabilityId)
            where.vulnerabilityId = vulnerabilityId;
        if (status)
            where.status = status;
        return this.upgradeTaskRepo.find({
            where,
            order: { createdAt: 'DESC' }
        });
    }
    async completeUpgradeTask(taskId, notes) {
        logger.info('完成升级任务', { taskId });
        const task = await this.upgradeTaskRepo.findOne({ where: { id: taskId } });
        if (!task) {
            throw new Error(`升级任务 ${taskId} 不存在`);
        }
        if (task.status === UpgradeTask_1.TaskStatus.COMPLETED) {
            throw new Error('升级任务已经完成，不能重复完成');
        }
        task.status = UpgradeTask_1.TaskStatus.COMPLETED;
        task.completedAt = new Date();
        if (notes) {
            task.notes = notes;
        }
        const saved = await this.upgradeTaskRepo.save(task);
        const otherTasks = await this.upgradeTaskRepo.find({
            where: { vulnerabilityId: task.vulnerabilityId }
        });
        const allCompleted = otherTasks.every(t => t.status === UpgradeTask_1.TaskStatus.COMPLETED);
        if (allCompleted) {
            const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: task.vulnerabilityId } });
            if (vulnerability && vulnerability.status === types_1.VulnerabilityStatus.IN_PROGRESS) {
                vulnerability.status = types_1.VulnerabilityStatus.FIXED;
                vulnerability.fixedAt = new Date();
                await this.vulnerabilityRepo.save(vulnerability);
                logger.info('漏洞所有升级任务完成，标记为已修复', { vulnerabilityId: task.vulnerabilityId });
            }
        }
        logger.info('升级任务完成', { taskId });
        return saved;
    }
}
exports.BatchService = BatchService;
//# sourceMappingURL=BatchService.js.map