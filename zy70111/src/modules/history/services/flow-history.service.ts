import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FlowHistory } from '../entities/flow-history.entity';
import { FlowAction, CertificateStatus, UserContext } from '../../../common/types';

@Injectable()
export class FlowHistoryService {
  constructor(
    @InjectRepository(FlowHistory)
    private readonly flowHistoryRepository: Repository<FlowHistory>,
  ) {}

  async recordAction(params: {
    certificateNumber: string;
    certificateId: string;
    action: FlowAction;
    description: string;
    previousStatus?: CertificateStatus;
    newStatus?: CertificateStatus;
    user: UserContext;
    changes?: any;
    snapshot?: any;
    relatedEntityId?: string;
    relatedEntityType?: string;
    isManualCorrection?: boolean;
    correctionReason?: string;
  }): Promise<FlowHistory> {
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

  async findByCertificateNumber(certificateNumber: string): Promise<FlowHistory[]> {
    return this.flowHistoryRepository.find({
      where: { certificateNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async findByCertificateId(certificateId: string): Promise<FlowHistory[]> {
    return this.flowHistoryRepository.find({
      where: { certificateId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByRelatedEntity(
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<FlowHistory[]> {
    return this.flowHistoryRepository.find({
      where: { relatedEntityType, relatedEntityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findManualCorrectionHistory(certificateId: string): Promise<FlowHistory[]> {
    return this.flowHistoryRepository.find({
      where: { certificateId, isManualCorrection: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getCertificateFullTimeline(certificateNumber: string): Promise<{
    histories: FlowHistory[];
    statusChanges: Array<{
      from: string;
      to: string;
      action: string;
      operator: string;
      time: Date;
    }>;
    hasManualCorrection: boolean;
    lastManualCorrection?: FlowHistory;
  }> {
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

  async getStatistics(certificateIds: string[]): Promise<{
    totalActions: number;
    manualCorrections: number;
    actionBreakdown: Record<string, number>;
  }> {
    const histories = await this.flowHistoryRepository.find({
      where: { certificateId: In(certificateIds) },
    });

    const actionBreakdown: Record<string, number> = {};
    let manualCorrections = 0;

    histories.forEach((h) => {
      actionBreakdown[h.action] = (actionBreakdown[h.action] || 0) + 1;
      if (h.isManualCorrection) manualCorrections++;
    });

    return {
      totalActions: histories.length,
      manualCorrections,
      actionBreakdown,
    };
  }
}
