import { GradingSheetRepository } from '../repositories/GradingSheetRepository.js';
import { CorrectionRepository } from '../repositories/CorrectionRepository.js';
import { ViscosityEstimateRepository } from '../repositories/ViscosityEstimateRepository.js';
import { SensorLogRepository } from '../repositories/SensorLogRepository.js';
import type { GradingSheet, GradingItem, TimelineEvent } from '../../shared/types.js';

export class GradingService {
  private gradingSheetRepo = new GradingSheetRepository();
  private correctionRepo = new CorrectionRepository();
  private viscosityRepo = new ViscosityEstimateRepository();
  private sensorLogRepo = new SensorLogRepository();

  getGradingSheet(batchId: string): GradingSheet | null {
    return this.gradingSheetRepo.findByBatchId(batchId);
  }

  generateGradingSheet(batchId: string): GradingSheet {
    const corrections = this.correctionRepo.findByBatchId(batchId);
    const viscosityEstimates = this.viscosityRepo.findByBatchId(batchId);
    const sensorLogs = this.sensorLogRepo.findByBatchId(batchId);

    const items: GradingItem[] = [];
    let totalScore = 0;
    const maxScore = 100;

    items.push({
      name: '实验数据完整性',
      score: sensorLogs.length >= 5 ? 20 : Math.max(0, sensorLogs.length * 4),
      maxScore: 20,
      evidenceIds: sensorLogs.map((l) => l.id),
      comment: sensorLogs.length >= 5
        ? '传感器日志完整，数据点充足'
        : `传感器日志不足，仅${sensorLogs.length}条记录，建议至少5条`,
    });

    const latestViscosity = viscosityEstimates.length > 0
      ? viscosityEstimates[viscosityEstimates.length - 1]
      : null;

    let viscosityScore = 0;
    let viscosityComment = '未执行黏度估计';
    const viscosityEvidenceIds: string[] = latestViscosity ? [latestViscosity.id] : [];

    if (latestViscosity) {
      viscosityEvidenceIds.push(...sensorLogs.map((l) => l.id));
      if (latestViscosity.judgment === 'pass') {
        viscosityScore = 40;
        viscosityComment = `黏度估计值 ${latestViscosity.viscosity?.toFixed(4)} mPa·s，处于正常范围，计算正确`;
      } else if (latestViscosity.judgment === 'borderline') {
        viscosityScore = 30;
        viscosityComment = `黏度估计值 ${latestViscosity.viscosity?.toFixed(4)} mPa·s，处于边界区域，已人工复核`;
      } else if (latestViscosity.judgment === 'fail') {
        viscosityScore = 20;
        viscosityComment = `黏度估计值 ${latestViscosity.viscosity?.toFixed(4)} mPa·s，超出正常范围，需检查实验操作`;
      } else {
        viscosityScore = 10;
        viscosityComment = '数据不足，无法完成可靠的黏度估计';
      }
    }
    items.push({
      name: '液体黏度估计',
      score: viscosityScore,
      maxScore: 40,
      evidenceIds: viscosityEvidenceIds,
      comment: viscosityComment,
    });

    const deductionPoints = corrections
      .filter((c) => c.category === 'deduction')
      .reduce((sum, c) => sum + (c.points || 0), 0);

    items.push({
      name: '批改意见扣分',
      score: Math.max(0, 20 - deductionPoints),
      maxScore: 20,
      evidenceIds: corrections.map((c) => c.id),
      comment: corrections.length > 0
        ? `共${corrections.length}条批改意见，累计扣分${deductionPoints}分`
        : '无批改意见',
    });

    items.push({
      name: '实验报告规范性',
      score: 20,
      maxScore: 20,
      evidenceIds: [],
      comment: '实验记录完整，格式规范',
    });

    totalScore = items.reduce((sum, item) => sum + item.score, 0);

    let finalComment = '';
    if (totalScore >= 90) {
      finalComment = '实验完成优秀，数据完整，计算准确，操作规范。';
    } else if (totalScore >= 75) {
      finalComment = '实验完成良好，数据基本完整，存在少量可改进之处。';
    } else if (totalScore >= 60) {
      finalComment = '实验基本完成，但存在一些问题需要注意，建议认真阅读批改意见。';
    } else {
      finalComment = '实验存在较多问题，建议重新学习实验原理并考虑重测。';
    }

    return this.gradingSheetRepo.create({
      batchId,
      createdAt: new Date().toISOString(),
      totalScore,
      maxScore,
      items,
      finalComment,
    });
  }

  getTimelineEvents(batchId: string): TimelineEvent[] {
    const estimates = this.viscosityRepo.findByBatchId(batchId);
    return estimates.map((e) => ({
      id: e.id,
      batchId: e.batchId,
      timestamp: e.timestamp,
      type: 'viscosity_estimate' as const,
      data: e,
    }));
  }
}
