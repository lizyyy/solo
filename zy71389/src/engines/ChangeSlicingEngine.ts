import { OperationChange, ExposureLog, ConversionData, PhaseResult, Metrics } from '../types';

export interface Phase {
  phaseId: string;
  phaseName: string;
  startTime: number;
  endTime: number;
  configVersion: string;
  change?: OperationChange;
}

export class ChangeSlicingEngine {
  static createPhases(
    operationChanges: OperationChange[],
    experimentStartTime: number,
    experimentEndTime: number
  ): Phase[] {
    const sortedChanges = [...operationChanges]
      .filter(c => c.changeTime >= experimentStartTime && c.changeTime <= experimentEndTime)
      .sort((a, b) => a.changeTime - b.changeTime);

    const phases: Phase[] = [];
    let currentTime = experimentStartTime;
    let currentVersion = 'v1';

    if (sortedChanges.length === 0) {
      phases.push({
        phaseId: 'phase_1',
        phaseName: '全周期',
        startTime: experimentStartTime,
        endTime: experimentEndTime,
        configVersion: currentVersion
      });
      return phases;
    }

    sortedChanges.forEach((change, index) => {
      phases.push({
        phaseId: `phase_${index + 1}`,
        phaseName: `阶段${index + 1}${index === 0 ? ' (初始配置)' : ''}`,
        startTime: currentTime,
        endTime: change.changeTime,
        configVersion: currentVersion,
        change: index > 0 ? sortedChanges[index - 1] : undefined
      });
      
      currentTime = change.changeTime;
      currentVersion = `v${index + 2}`;
    });

    phases.push({
      phaseId: `phase_${sortedChanges.length + 1}`,
      phaseName: `阶段${sortedChanges.length + 1} (最终配置)`,
      startTime: currentTime,
      endTime: experimentEndTime,
      configVersion: currentVersion,
      change: sortedChanges[sortedChanges.length - 1]
    });

    return phases;
  }

  static calculatePhaseMetrics(
    phase: Phase,
    exposures: ExposureLog[],
    conversions: ConversionData[],
    excludeContaminated: boolean = true
  ): Metrics {
    const phaseExposures = exposures.filter(e => 
      e.exposureTime >= phase.startTime && 
      e.exposureTime < phase.endTime &&
      (!excludeContaminated || !e.isContaminated)
    );

    const exposureIds = new Set(phaseExposures.map(e => e.exposureId));
    const phaseConversions = conversions.filter(c => 
      exposureIds.has(c.exposureId)
    );

    const uniqueUsers = new Set(phaseExposures.map(e => e.userId));

    const totalConversions = phaseConversions.length;
    const totalValue = phaseConversions.reduce((sum, c) => sum + c.conversionValue, 0);
    const conversionRate = phaseExposures.length > 0 ? totalConversions / phaseExposures.length : 0;
    const averageValue = totalConversions > 0 ? totalValue / totalConversions : 0;

    return {
      conversionRate,
      averageValue,
      totalConversions,
      totalValue,
      uniqueUsers: uniqueUsers.size
    };
  }

  static generatePhaseResults(
    phases: Phase[],
    exposures: ExposureLog[],
    conversions: ConversionData[]
  ): PhaseResult[] {
    return phases.map(phase => {
      const metrics = this.calculatePhaseMetrics(phase, exposures, conversions, true);
      const phaseExposures = exposures.filter(e => 
        e.exposureTime >= phase.startTime && 
        e.exposureTime < phase.endTime
      );
      const contaminationCount = phaseExposures.filter(e => e.isContaminated).length;

      return {
        phaseId: phase.phaseId,
        phaseName: phase.phaseName,
        startTime: phase.startTime,
        endTime: phase.endTime,
        configVersion: phase.configVersion,
        exposureCount: phaseExposures.length,
        contaminationCount,
        metrics
      };
    });
  }

  static isInConfigChangeWindow(
    exposureTime: number,
    operationChanges: OperationChange[],
    windowMinutes: number = 30
  ): { isInWindow: boolean; nearestChange?: OperationChange; timeDiffMinutes: number } {
    const windowMs = windowMinutes * 60 * 1000;
    let nearestChange: OperationChange | undefined;
    let minDiff = Infinity;

    for (const change of operationChanges) {
      const diff = Math.abs(exposureTime - change.changeTime);
      if (diff < minDiff) {
        minDiff = diff;
        nearestChange = change;
      }
    }

    const timeDiffMinutes = minDiff / (60 * 1000);
    return {
      isInWindow: minDiff <= windowMs,
      nearestChange,
      timeDiffMinutes
    };
  }

  static getConfigChangeReason(
    exposureTime: number,
    operationChanges: OperationChange[],
    windowMinutes: number = 30
  ): string {
    const { isInWindow, nearestChange, timeDiffMinutes } = this.isInConfigChangeWindow(
      exposureTime,
      operationChanges,
      windowMinutes
    );

    if (!isInWindow || !nearestChange) return '';

    const direction = exposureTime < nearestChange.changeTime ? '之前' : '之后';
    return `曝光发生在配置变更${direction}约${timeDiffMinutes.toFixed(1)}分钟，变更内容：${nearestChange.changeDescription}`;
  }
}
