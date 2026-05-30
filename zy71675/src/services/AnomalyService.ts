import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Anomaly } from '../entities/Anomaly';
import { AnomalyType, AnomalySeverity, AnomalyStatus, EntityType } from '../entities/enums';

export interface AnomalyContext {
  impactOnMoney?: string;
  impactOnTime?: string;
  impactOnRoster?: string;
  affectedFields?: string[];
  suggestedActions?: string[];
  context?: string;
}

export class AnomalyService {
  private anomalyRepository: Repository<Anomaly>;

  constructor() {
    this.anomalyRepository = AppDataSource.getRepository(Anomaly);
  }

  async createAnomaly(
    trackId: number,
    type: AnomalyType,
    severity: AnomalySeverity,
    description: string,
    relatedEntityType?: EntityType,
    relatedEntityId?: number,
    context?: AnomalyContext
  ): Promise<Anomaly> {
    const existing = await this.anomalyRepository.findOne({
      where: {
        trackId,
        type,
        relatedEntityType: relatedEntityType || undefined,
        relatedEntityId: relatedEntityId || undefined,
      },
    });

    if (existing) {
      existing.occurrences += 1;
      existing.description = description;
      existing.status = AnomalyStatus.OPEN;
      existing.updatedAt = new Date();
      return this.anomalyRepository.save(existing);
    }

    const anomaly = new Anomaly();
    anomaly.trackId = trackId;
    anomaly.type = type;
    anomaly.severity = severity;
    anomaly.description = description;
    anomaly.relatedEntityType = relatedEntityType;
    anomaly.relatedEntityId = relatedEntityId;
    anomaly.status = AnomalyStatus.OPEN;
    anomaly.occurrences = 1;

    if (context) {
      anomaly.impactOnMoney = context.impactOnMoney;
      anomaly.impactOnTime = context.impactOnTime;
      anomaly.impactOnRoster = context.impactOnRoster;
      anomaly.affectedFields = context.affectedFields;
      anomaly.suggestedActions = context.suggestedActions;
      anomaly.context = context.context;
    }

    return this.anomalyRepository.save(anomaly);
  }

  async resolveAnomaly(
    anomalyId: number,
    resolvedBy: string,
    resolutionNote: string
  ): Promise<Anomaly> {
    const anomaly = await this.anomalyRepository.findOne({
      where: { id: anomalyId },
    });

    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    anomaly.status = AnomalyStatus.RESOLVED;
    anomaly.resolvedBy = resolvedBy;
    anomaly.resolvedAt = new Date();
    anomaly.resolutionNote = resolutionNote;

    return this.anomalyRepository.save(anomaly);
  }

  async ignoreAnomaly(
    anomalyId: number,
    resolvedBy: string,
    resolutionNote: string
  ): Promise<Anomaly> {
    const anomaly = await this.anomalyRepository.findOne({
      where: { id: anomalyId },
    });

    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    anomaly.status = AnomalyStatus.IGNORED;
    anomaly.resolvedBy = resolvedBy;
    anomaly.resolvedAt = new Date();
    anomaly.resolutionNote = resolutionNote;

    return this.anomalyRepository.save(anomaly);
  }

  async getAnomaliesByTrack(trackId: number, status?: AnomalyStatus): Promise<Anomaly[]> {
    const where: any = { trackId };
    if (status) {
      where.status = status;
    }

    return this.anomalyRepository.find({
      where,
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  async getOpenAnomalies(severity?: AnomalySeverity): Promise<Anomaly[]> {
    const where: any = { status: AnomalyStatus.OPEN };
    if (severity) {
      where.severity = severity;
    }

    return this.anomalyRepository.find({
      where,
      order: { severity: 'DESC', createdAt: 'DESC' },
      relations: ['track'],
    });
  }

  async getAnomaliesByType(type: AnomalyType, status?: AnomalyStatus): Promise<Anomaly[]> {
    const where: any = { type };
    if (status) {
      where.status = status;
    }

    return this.anomalyRepository.find({
      where,
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  async getAnomaliesBySeverity(severity: AnomalySeverity, status?: AnomalyStatus): Promise<Anomaly[]> {
    const where: any = { severity };
    if (status) {
      where.status = status;
    }

    return this.anomalyRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getAnomalySummary(): Promise<{
    total: number;
    open: number;
    resolved: number;
    ignored: number;
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<AnomalyType, number>;
  }> {
    const all = await this.anomalyRepository.find();

    const summary = {
      total: all.length,
      open: all.filter(a => a.status === AnomalyStatus.OPEN).length,
      resolved: all.filter(a => a.status === AnomalyStatus.RESOLVED).length,
      ignored: all.filter(a => a.status === AnomalyStatus.IGNORED).length,
      bySeverity: {
        [AnomalySeverity.LOW]: all.filter(a => a.severity === AnomalySeverity.LOW).length,
        [AnomalySeverity.MEDIUM]: all.filter(a => a.severity === AnomalySeverity.MEDIUM).length,
        [AnomalySeverity.HIGH]: all.filter(a => a.severity === AnomalySeverity.HIGH).length,
        [AnomalySeverity.CRITICAL]: all.filter(a => a.severity === AnomalySeverity.CRITICAL).length,
      },
      byType: {} as Record<AnomalyType, number>,
    };

    for (const type of Object.values(AnomalyType)) {
      summary.byType[type as AnomalyType] = all.filter(a => a.type === type).length;
    }

    return summary;
  }

  async getAnomalyWithFullTrace(anomalyId: number): Promise<Anomaly | null> {
    return this.anomalyRepository.findOne({
      where: { id: anomalyId },
      relations: ['track', 'track.masterFiles', 'track.coverArts', 'track.deliveryReports'],
    });
  }

  async scanForDeadlineRisks(): Promise<Anomaly[]> {
    const result = await this.anomalyRepository.query(`
      SELECT DISTINCT t.id as trackId, t.title, t.artist, ps.deliveryDeadline
      FROM track t
      INNER JOIN delivery_report dr ON dr.trackId = t.id
      INNER JOIN platform_spec ps ON ps.id = dr.platformSpecId
      WHERE ps.deliveryDeadline IS NOT NULL
        AND ps.deliveryDeadline > datetime('now')
        AND ps.deliveryDeadline <= datetime('now', '+7 days')
        AND dr.status IN ('pending', 'validating', 'rejected')
    `);

    const anomalies: Anomaly[] = [];

    for (const row of result) {
      const daysLeft = Math.ceil(
        (new Date(row.deliveryDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      const anomaly = await this.createAnomaly(
        row.trackId,
        AnomalyType.DEADLINE_RISK,
        daysLeft <= 2 ? AnomalySeverity.CRITICAL : AnomalySeverity.HIGH,
        `交付截止日期临近：${row.title} - ${row.artist}，还有 ${daysLeft} 天截止`,
        EntityType.DELIVERY_REPORT,
        undefined,
        {
          impactOnMoney: '临近截止日期可能导致无法按时交付，需要加急处理产生额外费用',
          impactOnTime: `仅剩 ${daysLeft} 天，需要立即处理所有待办事项`,
          impactOnRoster: '如果错过截止日期，可能影响厂牌在该平台的发行优先级',
          suggestedActions: [
            '立即检查所有校验项是否通过',
            '确认母带和封面文件是否齐全',
            '联系相关人员确认审批进度',
            '必要时申请加急处理',
          ],
          context: `截止日期: ${row.deliveryDeadline}`,
        }
      );

      anomalies.push(anomaly);
    }

    return anomalies;
  }

  async scanForPaymentRisks(): Promise<Anomaly[]> {
    const tracks = await this.anomalyRepository.query(`
      SELECT id, title, artist, paymentAmount, paymentTerms, contractId, status
      FROM track
      WHERE (paymentAmount IS NULL OR paymentTerms IS NULL OR contractId IS NULL)
        AND status != 'archived'
    `);

    const anomalies: Anomaly[] = [];

    for (const track of tracks) {
      const missingFields: string[] = [];
      if (!track.paymentAmount) missingFields.push('付款金额');
      if (!track.paymentTerms) missingFields.push('付款条款');
      if (!track.contractId) missingFields.push('合同编号');

      const anomaly = await this.createAnomaly(
        track.id,
        AnomalyType.PAYMENT_RISK,
        AnomalySeverity.HIGH,
        `付款信息不完整：${track.title} - ${track.artist}，缺少 ${missingFields.join('、')}`,
        EntityType.TRACK,
        track.id,
        {
          impactOnMoney: '付款信息不完整可能导致版税无法结算或延迟支付',
          impactOnTime: '需要补充合同信息，可能影响财务流程',
          impactOnRoster: '财务问题可能影响与艺人的合作关系',
          affectedFields: missingFields,
          suggestedActions: [
            '确认合同条款并补充付款金额',
            '登记合同编号',
            '与财务部门确认付款流程',
          ],
        }
      );

      anomalies.push(anomaly);
    }

    return anomalies;
  }

  async scanForRosterRisks(): Promise<Anomaly[]> {
    const tracks = await this.anomalyRepository.query(`
      SELECT t.id, t.title, t.artist, t.rosterPriority, t.status, t.releaseDate
      FROM track t
      WHERE t.rosterPriority IS NULL 
        AND t.status NOT IN ('archived', 'delivered')
      ORDER BY t.releaseDate ASC
    `);

    const anomalies: Anomaly[] = [];

    for (const track of tracks) {
      const anomaly = await this.createAnomaly(
        track.id,
        AnomalyType.ROSTER_RISK,
        AnomalySeverity.MEDIUM,
        `发行优先级未设置：${track.title} - ${track.artist}，可能影响发行排期`,
        EntityType.TRACK,
        track.id,
        {
          impactOnMoney: '发行排期不合理可能影响销售预期和版税收入',
          impactOnTime: '未设置优先级可能导致发行时间冲突',
          impactOnRoster: '优先级混乱可能影响厂牌整体发行计划和艺人曝光机会',
          affectedFields: ['rosterPriority'],
          suggestedActions: [
            '根据艺人影响力和市场预期设置发行优先级',
            '检查发行排期表避免时间冲突',
            '与A&R部门确认发行策略',
          ],
        }
      );

      anomalies.push(anomaly);
    }

    return anomalies;
  }

  async scanAllAnomalies(): Promise<Anomaly[]> {
    const deadline = await this.scanForDeadlineRisks();
    const payment = await this.scanForPaymentRisks();
    const roster = await this.scanForRosterRisks();

    return [...deadline, ...payment, ...roster];
  }
}
