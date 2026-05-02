import {
  TemperatureRecord,
  DoorRecord,
  VaccineBatch,
  Anomaly,
  RiskFragment,
  UnifiedTimeline,
  AnalysisSummary,
  SessionAnalysis,
  AnomalyType,
  RiskLevel,
} from '../types';
import {
  RuleEngineConfig,
  DEFAULT_CONFIG,
  IRule,
  IRiskAssessor,
  ITimelineBuilder,
  RuleDetectionContext,
} from './types';

import { OverTempRule } from './rules/overTempRule';
import { UnderTempRule } from './rules/underTempRule';
import { MissingDataRule } from './rules/missingDataRule';
import { ProbeDisconnectRule } from './rules/probeDisconnectRule';
import { RapidChangeRule } from './rules/rapidChangeRule';
import { DoorOpenLongRule } from './rules/doorOpenLongRule';
import { TransferGapRule } from './rules/transferGapRule';
import { RiskAssessor } from './riskAssessor';
import { TimelineBuilder } from './timelineBuilder';

export class RuleEngine {
  private config: RuleEngineConfig;
  private rules: IRule[];
  private riskAssessor: IRiskAssessor;
  private timelineBuilder: ITimelineBuilder;

  constructor(config: Partial<RuleEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = this.initializeRules();
    this.riskAssessor = new RiskAssessor();
    this.timelineBuilder = new TimelineBuilder();
  }

  private initializeRules(): IRule[] {
    return [
      new OverTempRule(),
      new UnderTempRule(),
      new MissingDataRule(),
      new ProbeDisconnectRule(),
      new RapidChangeRule(),
      new DoorOpenLongRule(),
      new TransferGapRule(),
    ];
  }

  analyze(
    temperatureRecords: TemperatureRecord[],
    doorRecords: DoorRecord[],
    vaccineBatches: VaccineBatch[]
  ): SessionAnalysis {
    const anomalies = this.detectAnomalies(
      temperatureRecords,
      doorRecords,
      vaccineBatches
    );

    const riskFragments = this.assessRisks(
      vaccineBatches,
      anomalies,
      temperatureRecords
    );

    const unifiedTimeline = this.buildTimeline(
      temperatureRecords,
      doorRecords,
      vaccineBatches,
      anomalies,
      riskFragments
    );

    const summary = this.generateSummary(
      temperatureRecords,
      anomalies,
      riskFragments,
      unifiedTimeline
    );

    return {
      unifiedTimeline,
      anomalies,
      riskFragments,
      summary,
    };
  }

  private detectAnomalies(
    temperatureRecords: TemperatureRecord[],
    doorRecords: DoorRecord[],
    vaccineBatches: VaccineBatch[]
  ): Anomaly[] {
    const allAnomalies: Anomaly[] = [];

    const recordsByFridgeAndProbe = this.groupRecordsByFridgeAndProbe(temperatureRecords);

    for (const [fridgeId, recordsByProbe] of recordsByFridgeAndProbe) {
      for (const [probeId, records] of recordsByProbe) {
        const context: RuleDetectionContext = {
          fridgeId,
          probeId,
          records,
          doorRecords,
          config: this.config,
          vaccineBatches,
        };

        for (const rule of this.rules) {
          const result = rule.detect(context);
          allAnomalies.push(...result.anomalies);
        }
      }
    }

    return allAnomalies.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
  }

  private groupRecordsByFridgeAndProbe(
    records: TemperatureRecord[]
  ): Map<string, Map<string, TemperatureRecord[]>> {
    const result = new Map<string, Map<string, TemperatureRecord[]>>();

    for (const record of records) {
      if (!result.has(record.fridgeId)) {
        result.set(record.fridgeId, new Map());
      }
      const byProbe = result.get(record.fridgeId)!;
      if (!byProbe.has(record.probeId)) {
        byProbe.set(record.probeId, []);
      }
      byProbe.get(record.probeId)!.push(record);
    }

    return result;
  }

  private assessRisks(
    vaccineBatches: VaccineBatch[],
    anomalies: Anomaly[],
    temperatureRecords: TemperatureRecord[]
  ): RiskFragment[] {
    const allRiskFragments: RiskFragment[] = [];

    for (const batch of vaccineBatches) {
      const context = {
        vaccineBatch: batch,
        anomalies,
        temperatureRecords,
        doorRecords: [],
        config: this.config,
      };

      const fragments = this.riskAssessor.assess(context);
      allRiskFragments.push(...fragments);
    }

    return allRiskFragments.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
  }

  private buildTimeline(
    temperatureRecords: TemperatureRecord[],
    doorRecords: DoorRecord[],
    vaccineBatches: VaccineBatch[],
    anomalies: Anomaly[],
    riskFragments: RiskFragment[]
  ): UnifiedTimeline {
    return this.timelineBuilder.build(
      temperatureRecords,
      doorRecords,
      vaccineBatches,
      anomalies,
      riskFragments
    );
  }

  private generateSummary(
    temperatureRecords: TemperatureRecord[],
    anomalies: Anomaly[],
    riskFragments: RiskFragment[],
    timeline: UnifiedTimeline
  ): AnalysisSummary {
    const anomalyByType: Record<AnomalyType, number> = {
      over_temp: 0,
      under_temp: 0,
      missing_data: 0,
      rapid_change: 0,
      transfer_gap: 0,
      probe_disconnect: 0,
      door_open_long: 0,
    };

    for (const anomaly of anomalies) {
      anomalyByType[anomaly.type]++;
    }

    const riskByLevel: Record<RiskLevel, number> = {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    for (const fragment of riskFragments) {
      riskByLevel[fragment.riskLevel]++;
    }

    const affectedBatches = [...new Set(riskFragments.map(f => f.batchId))];

    return {
      totalRecords: temperatureRecords.length,
      totalAnomalies: anomalies.length,
      anomalyByType,
      totalRiskFragments: riskFragments.length,
      riskByLevel,
      affectedBatches,
      timeRange: {
        start: timeline.startTime,
        end: timeline.endTime,
      },
    };
  }

  updateConfig(newConfig: Partial<RuleEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): RuleEngineConfig {
    return { ...this.config };
  }

  addRule(rule: IRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleName: string): void {
    const index = this.rules.findIndex(r => r.name === ruleName);
    if (index !== -1) {
      this.rules.splice(index, 1);
    }
  }

  getRules(): IRule[] {
    return [...this.rules];
  }
}
