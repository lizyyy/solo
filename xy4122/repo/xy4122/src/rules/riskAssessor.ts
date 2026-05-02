import { v4 as uuidv4 } from 'uuid';
import { isWithinInterval, differenceInMinutes, min, max } from 'date-fns';
import {
  VaccineBatch,
  Anomaly,
  RiskFragment,
  RiskLevel,
  TemperatureRecord,
  ActionRecommendation,
} from '../types';
import { RiskFragmentContext, IRiskAssessor } from './types';

export class RiskAssessor implements IRiskAssessor {
  assess(context: RiskFragmentContext): RiskFragment[] {
    const { vaccineBatch, anomalies, temperatureRecords, config } = context;
    
    const relevantAnomalies = this.filterRelevantAnomalies(
      vaccineBatch,
      anomalies,
      temperatureRecords
    );

    if (relevantAnomalies.length === 0) {
      return [];
    }

    const groupedAnomalies = this.groupAnomaliesByTime(relevantAnomalies);

    const riskFragments: RiskFragment[] = [];

    for (const group of groupedAnomalies) {
      const fragment = this.createRiskFragment(
        vaccineBatch,
        group,
        temperatureRecords,
        config.defaultVaccineMinTemp,
        config.defaultVaccineMaxTemp
      );
      riskFragments.push(fragment);
    }

    return riskFragments;
  }

  private filterRelevantAnomalies(
    batch: VaccineBatch,
    anomalies: Anomaly[],
    temperatureRecords: TemperatureRecord[]
  ): Anomaly[] {
    const batchStart = batch.entryDate;
    const batchEnd = batch.exitDate || new Date();

    const relevantFridges = [batch.fridgeId];
    if (batch.targetFridgeId) {
      relevantFridges.push(batch.targetFridgeId);
    }

    return anomalies.filter(anomaly => {
      if (!relevantFridges.includes(anomaly.fridgeId)) {
        return false;
      }

      const anomalyInterval = {
        start: anomaly.startTime,
        end: anomaly.endTime,
      };

      const batchInterval = {
        start: batchStart,
        end: batchEnd,
      };

      return (
        isWithinInterval(anomaly.startTime, batchInterval) ||
        isWithinInterval(anomaly.endTime, batchInterval) ||
        (anomaly.startTime < batchStart && anomaly.endTime > batchEnd)
      );
    });
  }

  private groupAnomaliesByTime(anomalies: Anomaly[]): Anomaly[][] {
    if (anomalies.length === 0) return [];

    const sorted = [...anomalies].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const groups: Anomaly[][] = [];
    let currentGroup: Anomaly[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const lastInGroup = currentGroup[currentGroup.length - 1];

      const gapMinutes = differenceInMinutes(current.startTime, lastInGroup.endTime);

      if (gapMinutes <= 30) {
        currentGroup.push(current);
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private createRiskFragment(
    batch: VaccineBatch,
    anomalies: Anomaly[],
    temperatureRecords: TemperatureRecord[],
    defaultMinTemp: number,
    defaultMaxTemp: number
  ): RiskFragment {
    const startTimes = anomalies.map(a => a.startTime);
    const endTimes = anomalies.map(a => a.endTime);
    
    const fragmentStart = min(startTimes);
    const fragmentEnd = max(endTimes);
    const totalDuration = differenceInMinutes(fragmentEnd, fragmentStart);

    const relevantTemps = temperatureRecords.filter(r =>
      r.isValid &&
      isWithinInterval(r.timestamp, { start: fragmentStart, end: fragmentEnd })
    );

    const tempStats = this.calculateTemperatureStats(relevantTemps);

    const riskLevel = this.calculateRiskLevel(
      anomalies,
      totalDuration,
      batch,
      defaultMinTemp,
      defaultMaxTemp
    );

    const fridgeLocations = [...new Set(anomalies.map(a => a.fridgeId))];

    const recommendedAction = this.generateRecommendation(
      riskLevel,
      anomalies,
      batch
    );

    return {
      id: uuidv4(),
      batchId: batch.batchId,
      vaccineName: batch.vaccineName,
      anomalyIds: anomalies.map(a => a.id),
      startTime: fragmentStart,
      endTime: fragmentEnd,
      totalDurationMinutes: Math.max(totalDuration, 1),
      riskLevel,
      temperatureExposure: tempStats,
      fridgeLocations,
      recommendedAction,
    };
  }

  private calculateTemperatureStats(records: TemperatureRecord[]): {
    min: number;
    max: number;
    avg: number;
  } {
    if (records.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const temps = records.map(r => r.temperature);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;

    return {
      min: Math.round(minTemp * 10) / 10,
      max: Math.round(maxTemp * 10) / 10,
      avg: Math.round(avgTemp * 10) / 10,
    };
  }

  private calculateRiskLevel(
    anomalies: Anomaly[],
    durationMinutes: number,
    batch: VaccineBatch,
    defaultMinTemp: number,
    defaultMaxTemp: number
  ): RiskLevel {
    const hasCritical = anomalies.some(a => a.severity === 'critical');
    const hasWarning = anomalies.some(a => a.severity === 'warning');
    
    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const warningCount = anomalies.filter(a => a.severity === 'warning').length;

    if (hasCritical && (criticalCount > 1 || durationMinutes > 60)) {
      return 'high';
    }

    if (hasCritical || (hasWarning && warningCount > 2)) {
      return 'medium';
    }

    if (hasWarning || durationMinutes > 30) {
      return 'low';
    }

    return 'none';
  }

  private generateRecommendation(
    riskLevel: RiskLevel,
    anomalies: Anomaly[],
    batch: VaccineBatch
  ): ActionRecommendation {
    const actions: string[] = [];
    let priority: 'immediate' | 'urgent' | 'standard' | 'monitor' = 'standard';
    let deadlineHours: number | undefined;

    const anomalyTypes = [...new Set(anomalies.map(a => a.type))];

    switch (riskLevel) {
      case 'high':
        priority = 'immediate';
        deadlineHours = 2;
        actions.push('立即隔离该批次疫苗，暂停使用');
        actions.push('立即通知疾控中心和疫苗供应商');
        actions.push('启动疫苗不良反应应急预案');
        actions.push('详细记录所有相关信息，包括受种者名单');
        break;

      case 'medium':
        priority = 'urgent';
        deadlineHours = 24;
        actions.push('立即核查该批次疫苗的温度记录历史');
        actions.push('检查冰箱设备运行状态和校准记录');
        actions.push('评估疫苗质量，必要时抽样检测');
        actions.push('记录事件详情，向上级报告');
        break;

      case 'low':
        priority = 'standard';
        deadlineHours = 72;
        actions.push('检查冰箱门密封情况和开关记录');
        actions.push('确认温度探头工作正常');
        actions.push('增加该批次疫苗的温度监控频率');
        actions.push('记录事件，定期回顾');
        break;

      default:
        priority = 'monitor';
        actions.push('持续监控疫苗温度情况');
        actions.push('定期检查冰箱运行状态');
    }

    if (anomalyTypes.includes('over_temp')) {
      actions.push('特别关注超温对疫苗效价的影响');
    }
    if (anomalyTypes.includes('probe_disconnect')) {
      actions.push('检查温度探头连接情况，必要时更换探头');
    }
    if (anomalyTypes.includes('transfer_gap')) {
      actions.push('核查疫苗转移流程，完善交接记录');
      actions.push('确认转移过程中的冷链完整性');
    }
    if (anomalyTypes.includes('door_open_long')) {
      actions.push('加强冰箱开关管理，培训操作人员');
    }

    return {
      priority,
      actions,
      responsibleRole: '冷链管理员',
      deadlineHours,
    };
  }
}
