import { stringify } from 'csv-stringify/sync';
import { format } from 'date-fns';
import {
  ReviewSession,
  Anomaly,
  RiskFragment,
  VaccineBatch,
  AnomalyType,
  SeverityLevel,
  RiskLevel,
} from '../types';

const ANOMALY_TYPE_NAMES: Record<AnomalyType, string> = {
  over_temp: '超温',
  under_temp: '低温',
  missing_data: '缺测',
  rapid_change: '温度波动',
  transfer_gap: '转移空档',
  probe_disconnect: '探头断线',
  door_open_long: '长时间开门',
};

const SEVERITY_LEVEL_NAMES: Record<SeverityLevel, string> = {
  critical: '严重',
  warning: '警告',
  info: '信息',
};

const RISK_LEVEL_NAMES: Record<RiskLevel, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
  none: '无风险',
};

export interface CSVExportResult {
  anomalies: string;
  riskFragments: string;
  batches: string;
}

export class CSVExporter {
  export(session: ReviewSession): CSVExportResult {
    return {
      anomalies: this.exportAnomalies(session.analysis.anomalies),
      riskFragments: this.exportRiskFragments(session.analysis.riskFragments),
      batches: this.exportBatches(
        session.data.vaccineBatches,
        session.analysis.riskFragments
      ),
    };
  }

  private exportAnomalies(anomalies: Anomaly[]): string {
    if (anomalies.length === 0) {
      return stringify([['异常ID', '异常类型', '严重程度', '冰箱ID', '探头ID', '开始时间', '结束时间', '持续时间(分钟)', '描述', '元数据']]);
    }

    const data = anomalies.map(anomaly => [
      anomaly.id,
      ANOMALY_TYPE_NAMES[anomaly.type],
      SEVERITY_LEVEL_NAMES[anomaly.severity],
      anomaly.fridgeId,
      anomaly.probeId,
      format(anomaly.startTime, 'yyyy-MM-dd HH:mm:ss'),
      format(anomaly.endTime, 'yyyy-MM-dd HH:mm:ss'),
      anomaly.durationMinutes,
      anomaly.description,
      JSON.stringify(anomaly.metadata),
    ]);

    return stringify([
      ['异常ID', '异常类型', '严重程度', '冰箱ID', '探头ID', '开始时间', '结束时间', '持续时间(分钟)', '描述', '元数据'],
      ...data,
    ]);
  }

  private exportRiskFragments(riskFragments: RiskFragment[]): string {
    if (riskFragments.length === 0) {
      return stringify([['片段ID', '批次号', '疫苗名称', '风险等级', '开始时间', '结束时间', '持续时间(分钟)', '最低温度', '最高温度', '平均温度', '涉及冰箱', '建议措施']]);
    }

    const data = riskFragments.map(fragment => [
      fragment.id,
      fragment.batchId,
      fragment.vaccineName,
      RISK_LEVEL_NAMES[fragment.riskLevel],
      format(fragment.startTime, 'yyyy-MM-dd HH:mm:ss'),
      format(fragment.endTime, 'yyyy-MM-dd HH:mm:ss'),
      fragment.totalDurationMinutes,
      fragment.temperatureExposure.min,
      fragment.temperatureExposure.max,
      fragment.temperatureExposure.avg,
      fragment.fridgeLocations.join(';'),
      fragment.recommendedAction.actions.join('; '),
    ]);

    return stringify([
      ['片段ID', '批次号', '疫苗名称', '风险等级', '开始时间', '结束时间', '持续时间(分钟)', '最低温度', '最高温度', '平均温度', '涉及冰箱', '建议措施'],
      ...data,
    ]);
  }

  private exportBatches(
    batches: VaccineBatch[],
    riskFragments: RiskFragment[]
  ): string {
    if (batches.length === 0) {
      return stringify([['批次号', '疫苗名称', '生产厂家', '数量', '最低存储温度', '最高存储温度', '有效期开始', '有效期结束', '当前冰箱', '风险数量', '最高风险等级']]);
    }

    const data = batches.map(batch => {
      const batchRisks = riskFragments.filter(r => r.batchId === batch.batchId);
      const highestRisk = this.getHighestRiskLevel(batchRisks);

      return [
        batch.batchId,
        batch.vaccineName,
        batch.manufacturer,
        batch.quantity,
        batch.minTemp,
        batch.maxTemp,
        format(batch.validFrom, 'yyyy-MM-dd'),
        format(batch.validTo, 'yyyy-MM-dd'),
        batch.fridgeId,
        batchRisks.length,
        RISK_LEVEL_NAMES[highestRisk],
      ];
    });

    return stringify([
      ['批次号', '疫苗名称', '生产厂家', '数量', '最低存储温度', '最高存储温度', '有效期开始', '有效期结束', '当前冰箱', '风险数量', '最高风险等级'],
      ...data,
    ]);
  }

  private getHighestRiskLevel(fragments: RiskFragment[]): RiskLevel {
    if (fragments.length === 0) return 'none';
    
    const levels: RiskLevel[] = ['high', 'medium', 'low', 'none'];
    for (const level of levels) {
      if (fragments.some(f => f.riskLevel === level)) {
        return level;
      }
    }
    return 'none';
  }
}
