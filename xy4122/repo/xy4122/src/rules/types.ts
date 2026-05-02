import {
  TemperatureRecord,
  DoorRecord,
  VaccineBatch,
  Anomaly,
  RiskFragment,
  UnifiedTimeline,
  AlertThresholds,
  AnomalyType,
  SeverityLevel,
  RiskLevel,
} from '../types';

export interface RuleEngineConfig {
  thresholds: AlertThresholds;
  defaultVaccineMinTemp: number;
  defaultVaccineMaxTemp: number;
  probeDisconnectThreshold: number;
  transferGapThresholdMinutes: number;
}

export const DEFAULT_CONFIG: RuleEngineConfig = {
  thresholds: {
    overTempThreshold: 8,
    underTempThreshold: 2,
    missingDataMinutes: 30,
    rapidChangeThreshold: 2,
    doorOpenMinutes: 5,
  },
  defaultVaccineMinTemp: 2,
  defaultVaccineMaxTemp: 8,
  probeDisconnectThreshold: -80,
  transferGapThresholdMinutes: 15,
};

export interface RuleDetectionContext {
  fridgeId: string;
  probeId: string;
  records: TemperatureRecord[];
  doorRecords: DoorRecord[];
  config: RuleEngineConfig;
  vaccineBatches: VaccineBatch[];
}

export interface RuleResult {
  anomalies: Anomaly[];
}

export interface IRule {
  name: string;
  anomalyType: AnomalyType;
  detect(context: RuleDetectionContext): RuleResult;
}

export interface RiskFragmentContext {
  vaccineBatch: VaccineBatch;
  anomalies: Anomaly[];
  temperatureRecords: TemperatureRecord[];
  doorRecords: DoorRecord[];
  config: RuleEngineConfig;
}

export interface IRiskAssessor {
  assess(context: RiskFragmentContext): RiskFragment[];
}

export interface ITimelineBuilder {
  build(
    temperatureRecords: TemperatureRecord[],
    doorRecords: DoorRecord[],
    vaccineBatches: VaccineBatch[],
    anomalies: Anomaly[],
    riskFragments: RiskFragment[]
  ): UnifiedTimeline;
}

export interface SeverityCalculator {
  calculate(
    anomalyType: AnomalyType,
    durationMinutes: number,
    temperature?: number,
    config?: RuleEngineConfig
  ): SeverityLevel;
}

export interface RiskLevelCalculator {
  calculate(
    anomalies: Anomaly[],
    durationMinutes: number,
    vaccineBatch: VaccineBatch
  ): RiskLevel;
}

export interface ActionRecommendationGenerator {
  generate(
    riskFragment: RiskFragment,
    anomalies: Anomaly[]
  ): {
    priority: 'immediate' | 'urgent' | 'standard' | 'monitor';
    actions: string[];
    responsibleRole: string;
    deadlineHours?: number;
  };
}
