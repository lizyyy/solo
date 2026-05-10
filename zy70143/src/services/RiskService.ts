import { Repository } from 'typeorm';
import { RiskItem, RiskStatus } from '../entities/RiskItem';
import { Vulnerability } from '../entities/Vulnerability';
import { RiskLevel, VulnerabilityStatus } from '../types';
import { createAuditLogger } from '../logger';

const logger = createAuditLogger('RiskService');

export class RiskService {
  constructor(
    private riskItemRepo: Repository<RiskItem>,
    private vulnerabilityRepo: Repository<Vulnerability>
  ) {}

  async createRiskItem(data: {
    vulnerabilityId?: string;
    title: string;
    description: string;
    level: RiskLevel;
    mitigationPlan?: string;
    ownerId?: string;
    ownerName?: string;
    dueDate?: Date;
  }): Promise<RiskItem> {
    logger.info('创建风险项', { title: data.title, level: data.level });

    if (data.vulnerabilityId) {
      const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: data.vulnerabilityId } });
      if (!vulnerability) {
        throw new Error(`关联的漏洞 ${data.vulnerabilityId} 不存在`);
      }
    }

    const riskItem = this.riskItemRepo.create({
      ...data,
      status: RiskStatus.OPEN
    });

    const saved = await this.riskItemRepo.save(riskItem);
    logger.info('风险项创建成功', { riskId: saved.id });

    return saved;
  }

  async getRiskItem(id: string): Promise<RiskItem | null> {
    return this.riskItemRepo.findOne({ where: { id } });
  }

  async listRiskItems(filters?: {
    status?: RiskStatus;
    level?: RiskLevel;
    vulnerabilityId?: string;
    ownerId?: string;
  }): Promise<RiskItem[]> {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.level) where.level = filters.level;
    if (filters?.vulnerabilityId) where.vulnerabilityId = filters.vulnerabilityId;
    if (filters?.ownerId) where.ownerId = filters.ownerId;

    return this.riskItemRepo.find({
      where,
      order: {
        level: 'DESC',
        createdAt: 'DESC'
      }
    });
  }

  async updateRiskStatus(
    riskId: string,
    newStatus: RiskStatus,
    resolutionNote?: string,
    operatorId?: string,
    operatorName?: string
  ): Promise<RiskItem> {
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

    if (newStatus === RiskStatus.MITIGATED || newStatus === RiskStatus.CLOSED || newStatus === RiskStatus.ACCEPTED) {
      riskItem.resolvedAt = new Date();
    }

    const saved = await this.riskItemRepo.save(riskItem);
    logger.info('风险项状态更新成功', { riskId, from: riskItem.status, to: newStatus });

    return saved;
  }

  async getRiskDashboard(): Promise<{
    summary: {
      total: number;
      byLevel: Record<RiskLevel, number>;
      byStatus: Record<RiskStatus, number>;
      overdue: number;
    };
    topRisks: RiskItem[];
    recentlyAdded: RiskItem[];
  }> {
    const allRisks = await this.riskItemRepo.find();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byLevel: Record<RiskLevel, number> = {
      [RiskLevel.EXTREME]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.LOW]: 0
    };

    const byStatus: Record<RiskStatus, number> = {
      [RiskStatus.OPEN]: 0,
      [RiskStatus.MITIGATED]: 0,
      [RiskStatus.ACCEPTED]: 0,
      [RiskStatus.CLOSED]: 0
    };

    let overdue = 0;
    for (const r of allRisks) {
      byLevel[r.level]++;
      byStatus[r.status]++;
      if (r.dueDate && r.dueDate < today && r.status === RiskStatus.OPEN) {
        overdue++;
      }
    }

    const levelPriority: Record<RiskLevel, number> = {
      [RiskLevel.EXTREME]: 4,
      [RiskLevel.HIGH]: 3,
      [RiskLevel.MEDIUM]: 2,
      [RiskLevel.LOW]: 1
    };

    const topRisks = allRisks
      .filter(r => r.status === RiskStatus.OPEN)
      .sort((a, b) => {
        const levelDiff = levelPriority[b.level] - levelPriority[a.level];
        if (levelDiff !== 0) return levelDiff;
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
