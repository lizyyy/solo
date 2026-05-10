import { Repository } from 'typeorm';
import { Batch } from '../entities/Batch';
import { Vulnerability } from '../entities/Vulnerability';
import { UpgradeTask, TaskStatus } from '../entities/UpgradeTask';
import { VulnerabilityStatus, BatchStatus } from '../types';
import { BusinessRuleValidator } from './BusinessRuleValidator';
import { createAuditLogger } from '../logger';

const logger = createAuditLogger('BatchService');

export class BatchService {
  constructor(
    private batchRepo: Repository<Batch>,
    private vulnerabilityRepo: Repository<Vulnerability>,
    private upgradeTaskRepo: Repository<UpgradeTask>
  ) {}

  async createBatch(data: {
    name: string;
    code: string;
    description: string;
    plannedDate: Date;
    ownerId?: string;
    ownerName?: string;
  }): Promise<Batch> {
    logger.info('创建批次', { code: data.code, name: data.name });

    const existing = await this.batchRepo.findOne({ where: { code: data.code } });
    if (existing) {
      throw new Error(`批次编码 ${data.code} 已存在`);
    }

    const batch = this.batchRepo.create({
      ...data,
      status: BatchStatus.PLANNED
    });

    const saved = await this.batchRepo.save(batch);
    logger.info('批次创建成功', { batchId: saved.id, code: data.code });

    return saved;
  }

  async getBatch(id: string): Promise<Batch | null> {
    return this.batchRepo.findOne({ where: { id } });
  }

  async listBatches(status?: BatchStatus): Promise<Batch[]> {
    const where: any = {};
    if (status) where.status = status;

    return this.batchRepo.find({
      where,
      order: { plannedDate: 'ASC' }
    });
  }

  async addVulnerabilityToBatch(batchId: string, vulnerabilityId: string): Promise<void> {
    logger.info('将漏洞加入批次', { batchId, vulnerabilityId });

    const batch = await this.getBatch(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    if (batch.status === BatchStatus.DEPLOYED) {
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

  async getBatchVulnerabilities(batchId: string): Promise<Vulnerability[]> {
    return this.vulnerabilityRepo.find({
      where: { batchId },
      order: { severity: 'DESC', createdAt: 'ASC' }
    });
  }

  async checkBatchHealth(batchId: string): Promise<{
    batch: Batch;
    vulnerabilities: Vulnerability[];
    consistent: boolean;
    issues: string[];
    summary: {
      total: number;
      byStatus: Record<VulnerabilityStatus, number>;
      overdue: number;
    };
  }> {
    const batch = await this.getBatch(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const vulnerabilities = await this.getBatchVulnerabilities(batchId);
    const consistency = BusinessRuleValidator.checkBatchConsistency(batch.status, vulnerabilities);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byStatus: Record<VulnerabilityStatus, number> = {
      [VulnerabilityStatus.NEW]: 0,
      [VulnerabilityStatus.ASSIGNED]: 0,
      [VulnerabilityStatus.IN_PROGRESS]: 0,
      [VulnerabilityStatus.DELAYED]: 0,
      [VulnerabilityStatus.FIXED]: 0,
      [VulnerabilityStatus.DEPLOYED]: 0,
      [VulnerabilityStatus.CLOSED]: 0
    };

    let overdue = 0;
    for (const v of vulnerabilities) {
      byStatus[v.status]++;
      if (v.dueDate && v.dueDate < today && v.status !== VulnerabilityStatus.CLOSED && v.status !== VulnerabilityStatus.DEPLOYED) {
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

  async deployBatch(batchId: string, deployedAt: Date = new Date()): Promise<Batch> {
    logger.info('上线批次', { batchId });

    const health = await this.checkBatchHealth(batchId);

    if (!health.consistent) {
      logger.warn('批次一致性检查失败', { batchId, issues: health.issues });
    }

    const uncompleted = health.vulnerabilities.filter(
      v => v.status !== VulnerabilityStatus.FIXED && v.status !== VulnerabilityStatus.DEPLOYED && v.status !== VulnerabilityStatus.CLOSED
    );

    if (uncompleted.length > 0) {
      throw new Error(`批次中有 ${uncompleted.length} 个漏洞未修复，不能上线`);
    }

    const batch = health.batch;
    batch.status = BatchStatus.DEPLOYED;
    batch.deployedAt = deployedAt;

    const saved = await this.batchRepo.save(batch);

    for (const v of health.vulnerabilities) {
      if (v.status === VulnerabilityStatus.FIXED) {
        v.status = VulnerabilityStatus.DEPLOYED;
        await this.vulnerabilityRepo.save(v);
      }
    }

    logger.info('批次上线成功', { batchId, deployedAt });

    return saved;
  }

  async createUpgradeTask(data: {
    vulnerabilityId: string;
    title: string;
    description: string;
    packageName: string;
    fromVersion: string;
    toVersion: string;
    assigneeId?: string;
    assigneeName?: string;
  }): Promise<UpgradeTask> {
    logger.info('创建升级任务', { vulnerabilityId: data.vulnerabilityId, title: data.title });

    const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: data.vulnerabilityId } });
    if (!vulnerability) {
      throw new Error(`漏洞 ${data.vulnerabilityId} 不存在`);
    }

    const task = this.upgradeTaskRepo.create({
      ...data,
      status: TaskStatus.PENDING
    });

    const saved = await this.upgradeTaskRepo.save(task);

    if (vulnerability.status === VulnerabilityStatus.ASSIGNED) {
      vulnerability.status = VulnerabilityStatus.IN_PROGRESS;
      await this.vulnerabilityRepo.save(vulnerability);
    }

    logger.info('升级任务创建成功', { taskId: saved.id });

    return saved;
  }

  async getUpgradeTasks(vulnerabilityId?: string, status?: TaskStatus): Promise<UpgradeTask[]> {
    const where: any = {};
    if (vulnerabilityId) where.vulnerabilityId = vulnerabilityId;
    if (status) where.status = status;

    return this.upgradeTaskRepo.find({
      where,
      order: { createdAt: 'DESC' }
    });
  }

  async completeUpgradeTask(taskId: string, notes?: string): Promise<UpgradeTask> {
    logger.info('完成升级任务', { taskId });

    const task = await this.upgradeTaskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new Error(`升级任务 ${taskId} 不存在`);
    }

    if (task.status === TaskStatus.COMPLETED) {
      throw new Error('升级任务已经完成，不能重复完成');
    }

    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();
    if (notes) {
      task.notes = notes;
    }

    const saved = await this.upgradeTaskRepo.save(task);

    const otherTasks = await this.upgradeTaskRepo.find({
      where: { vulnerabilityId: task.vulnerabilityId }
    });

    const allCompleted = otherTasks.every(t => t.status === TaskStatus.COMPLETED);
    if (allCompleted) {
      const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: task.vulnerabilityId } });
      if (vulnerability && vulnerability.status === VulnerabilityStatus.IN_PROGRESS) {
        vulnerability.status = VulnerabilityStatus.FIXED;
        vulnerability.fixedAt = new Date();
        await this.vulnerabilityRepo.save(vulnerability);
        logger.info('漏洞所有升级任务完成，标记为已修复', { vulnerabilityId: task.vulnerabilityId });
      }
    }

    logger.info('升级任务完成', { taskId });

    return saved;
  }
}
