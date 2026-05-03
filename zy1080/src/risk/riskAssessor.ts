import {
  Plant,
  Pot,
  SimulatedPotState,
  RiskEvent,
  RiskType,
  SimulationResult,
} from '../types';
import { MathUtils, DateUtils } from '../utils';

interface RiskConfig {
  type: RiskType;
  threshold: number;
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
  criticalThreshold: number;
}

const RISK_CONFIGS: RiskConfig[] = [
  {
    type: 'drought',
    threshold: 20,
    lowThreshold: 15,
    mediumThreshold: 10,
    highThreshold: 5,
    criticalThreshold: 3,
  },
  {
    type: 'waterlogging',
    threshold: 85,
    lowThreshold: 85,
    mediumThreshold: 90,
    highThreshold: 95,
    criticalThreshold: 98,
  },
  {
    type: 'rootRot',
    threshold: 3,
    lowThreshold: 3,
    mediumThreshold: 5,
    highThreshold: 7,
    criticalThreshold: 10,
  },
  {
    type: 'etiolation',
    threshold: 0.6,
    lowThreshold: 0.6,
    mediumThreshold: 0.7,
    highThreshold: 0.8,
    criticalThreshold: 0.9,
  },
  {
    type: 'fertilizerBurn',
    threshold: 5,
    lowThreshold: 5,
    mediumThreshold: 10,
    highThreshold: 15,
    criticalThreshold: 20,
  },
];

interface DailyPotContext {
  pot: Pot;
  plant: Plant;
  dailyStates: SimulatedPotState[];
  consecutiveWaterloggingDays: number;
  consecutiveLowMoistureDays: number;
  fertilizerAccumulation: number;
  etiolationScore: number;
}

export class RiskAssessor {
  private pots: Pot[];
  private plants: Plant[];
  private plantMap: Map<string, Plant>;
  private potMap: Map<string, Pot>;

  constructor(pots: Pot[], plants: Plant[]) {
    this.pots = pots;
    this.plants = plants;
    this.plantMap = new Map(plants.map(p => [p.id, p]));
    this.potMap = new Map(pots.map(p => [p.id, p]));
  }

  assessDroughtRisk(
    state: SimulatedPotState,
    plant: Plant,
    pot: Pot,
    context: DailyPotContext
  ): RiskEvent | null {
    const moisturePercent = state.soilMoisturePercent;
    const minMoisture = plant.minMoisture;

    if (moisturePercent > minMoisture) {
      return null;
    }

    const riskScore = this.calculateRiskScore(
      moisturePercent,
      minMoisture,
      0,
      false
    );

    const riskLevel = this.getRiskLevel(riskScore);

    const contributingFactors: string[] = [];
    if (moisturePercent < minMoisture * 0.5) {
      contributingFactors.push('土壤含水量严重不足');
    } else {
      contributingFactors.push('土壤含水量低于建议下限');
    }

    if (context.consecutiveLowMoistureDays >= 2) {
      contributingFactors.push(`已连续 ${context.consecutiveLowMoistureDays} 天含水量偏低`);
    }

    let suggestion = '';
    if (riskLevel === 'low') {
      suggestion = '建议检查土壤湿度，考虑增加浇水频率';
    } else if (riskLevel === 'medium') {
      suggestion = '建议立即浇水，调整浇水计划';
    } else if (riskLevel === 'high') {
      suggestion = '严重缺水，请立即大量浇水，并检查根系状态';
    } else {
      suggestion = '紧急缺水，植物可能已经萎蔫，需立即抢救';
    }

    return {
      potId: state.potId,
      potName: state.potName,
      plantName: state.plantName,
      date: state.date,
      riskType: 'drought',
      riskLevel,
      score: MathUtils.round(riskScore * 100, 2),
      description: `${state.plantName} 缺水风险 - 当前含水量 ${moisturePercent}%，建议范围 ${plant.minMoisture}%-${plant.maxMoisture}%`,
      contributingFactors,
      suggestion,
    };
  }

  assessWaterloggingRisk(
    state: SimulatedPotState,
    plant: Plant,
    pot: Pot,
    context: DailyPotContext
  ): RiskEvent | null {
    const moisturePercent = state.soilMoisturePercent;
    const maxMoisture = plant.maxMoisture;

    if (moisturePercent < maxMoisture) {
      return null;
    }

    const riskScore = this.calculateRiskScore(
      moisturePercent,
      maxMoisture,
      100,
      true
    );

    const riskLevel = this.getRiskLevel(riskScore);

    const contributingFactors: string[] = [];
    if (moisturePercent > 95) {
      contributingFactors.push('土壤接近饱和状态');
    } else {
      contributingFactors.push('土壤含水量超过建议上限');
    }

    if (pot.drainageRate < 5) {
      contributingFactors.push('花盆排水速率较低');
    }

    if (context.consecutiveWaterloggingDays >= 1) {
      contributingFactors.push(`已连续 ${context.consecutiveWaterloggingDays} 天含水量偏高`);
    }

    let suggestion = '';
    if (riskLevel === 'low') {
      suggestion = '注意减少浇水量，确保排水良好';
    } else if (riskLevel === 'medium') {
      suggestion = '减少浇水频率，检查排水孔是否畅通';
    } else if (riskLevel === 'high') {
      suggestion = '严重积水，请停止浇水，检查根系';
    } else {
      suggestion = '紧急积水，植物可能窒息，请立即处理排水';
    }

    return {
      potId: state.potId,
      potName: state.potName,
      plantName: state.plantName,
      date: state.date,
      riskType: 'waterlogging',
      riskLevel,
      score: MathUtils.round(riskScore * 100, 2),
      description: `${state.plantName} 积水风险 - 当前含水量 ${moisturePercent}%，建议范围 ${plant.minMoisture}%-${plant.maxMoisture}%`,
      contributingFactors,
      suggestion,
    };
  }

  assessRootRotRisk(
    state: SimulatedPotState,
    plant: Plant,
    pot: Pot,
    context: DailyPotContext
  ): RiskEvent | null {
    const consecutiveDays = context.consecutiveWaterloggingDays;

    if (consecutiveDays < 2) {
      return null;
    }

    const riskScore = this.calculateRiskScore(
      consecutiveDays,
      2,
      14,
      true
    );

    const riskLevel = this.getRiskLevel(riskScore);

    const contributingFactors: string[] = [];
    contributingFactors.push(`已连续 ${consecutiveDays} 天土壤含水量过高`);

    if (pot.drainageRate < 5) {
      contributingFactors.push('花盆排水不良');
    }

    if (pot.soilWaterRetention > 0.8) {
      contributingFactors.push('土壤保水性过强');
    }

    let suggestion = '';
    if (riskLevel === 'low') {
      suggestion = '改善排水条件，减少浇水频率';
    } else if (riskLevel === 'medium') {
      suggestion = '停止浇水，检查根系状态，考虑换土';
    } else if (riskLevel === 'high') {
      suggestion = '立即检查根系，可能需要换土，改善排水';
    } else {
      suggestion = '紧急烂根风险，请立即处理，换土换盆';
    }

    return {
      potId: state.potId,
      potName: state.potName,
      plantName: state.plantName,
      date: state.date,
      riskType: 'rootRot',
      riskLevel,
      score: MathUtils.round(riskScore * 100, 2),
      description: `${state.plantName} 烂根风险 - 已连续 ${consecutiveDays} 天土壤处于高含水量状态`,
      contributingFactors,
      suggestion,
    };
  }

  assessEtiolationRisk(
    state: SimulatedPotState,
    plant: Plant,
    pot: Pot,
    context: DailyPotContext
  ): RiskEvent | null {
    const moisturePercent = state.soilMoisturePercent;
    const optimalMoisture = plant.optimalMoisture;

    const moistureFactor = moisturePercent > optimalMoisture ? (moisturePercent - optimalMoisture) / (100 - optimalMoisture) : 0;
    const etiolationScore = moistureFactor * 0.7 + context.etiolationScore * 0.3;

    if (etiolationScore < 0.3) {
      return null;
    }

    const riskScore = this.calculateRiskScore(
      etiolationScore,
      0.3,
      1,
      true
    );

    const riskLevel = this.getRiskLevel(riskScore);

    const contributingFactors: string[] = [];
    if (moisturePercent > optimalMoisture + 10) {
      contributingFactors.push('土壤含水量过高，可能导致徒长');
    }

    let suggestion = '';
    if (riskLevel === 'low') {
      suggestion = '注意控制浇水量，增加光照';
    } else if (riskLevel === 'medium') {
      suggestion = '减少浇水，增加光照，可能需要修剪';
    } else if (riskLevel === 'high') {
      suggestion = '严重徒长风险，请控制浇水，增加光照，修剪徒长枝';
    } else {
      suggestion = '紧急徒长，请立即调整浇水和光照条件';
    }

    return {
      potId: state.potId,
      potName: state.potName,
      plantName: state.plantName,
      date: state.date,
      riskType: 'etiolation',
      riskLevel,
      score: MathUtils.round(riskScore * 100, 2),
      description: `${state.plantName} 徒长风险 - 当前含水量 ${moisturePercent}%，最佳含水量 ${optimalMoisture}%`,
      contributingFactors,
      suggestion,
    };
  }

  assessFertilizerBurnRisk(
    state: SimulatedPotState,
    plant: Plant,
    pot: Pot,
    context: DailyPotContext
  ): RiskEvent | null {
    const fertilizerAmount = state.fertilizerAmount;
    const totalAccumulation = context.fertilizerAccumulation + fertilizerAmount;

    if (totalAccumulation < 3) {
      return null;
    }

    const riskScore = this.calculateRiskScore(
      totalAccumulation,
      3,
      30,
      true
    );

    const riskLevel = this.getRiskLevel(riskScore);

    const contributingFactors: string[] = [];
    if (fertilizerAmount > 0) {
      contributingFactors.push(`本次施肥 ${fertilizerAmount} 单位');
    }
    contributingFactors.push(`累计施肥 ${totalAccumulation} 单位`);

    let suggestion = '';
    if (riskLevel === 'low') {
      suggestion = '注意施肥量，增加浇水稀释';
    } else if (riskLevel === 'medium') {
      suggestion = '减少施肥频率，增加浇水';
    } else if (riskLevel === 'high') {
      suggestion = '停止施肥，大量浇水稀释';
    } else {
      suggestion = '严重肥害风险，请换土换盆';
    }

    return {
      potId: state.potId,
      potName: state.potName,
      plantName: state.plantName,
      date: state.date,
      riskType: 'fertilizerBurn',
      riskLevel,
      score: MathUtils.round(riskScore * 100, 2),
      description: `${state.plantName} 肥害风险 - 累计施肥 ${totalAccumulation} 单位`,
      contributingFactors,
      suggestion,
    };
  }

  calculateRiskScore(
    value: number,
    threshold: number,
    maxValue: number,
    isHigherRisk: boolean
  ): number {
    return MathUtils.calculateRiskScore(value, threshold, maxValue, isHigherRisk);
  }

  getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
  }

  assessAllRisks(
    simulationResult: SimulationResult
  ): RiskEvent[] {
    const allRisks: RiskEvent[] = [];

    const statesByPotAndDate = this.groupStatesByPotAndDate(simulationResult.potStates);

    for (const [potId, dateStates] of statesByPotAndDate) {
      const pot = this.potMap.get(potId);
      if (!pot) continue;

      const plant = this.plantMap.get(pot.plantId);
      if (!plant) continue;

      const context: DailyPotContext = {
        pot,
        plant,
        dailyStates: [],
        consecutiveWaterloggingDays: 0,
        consecutiveLowMoistureDays: 0,
        fertilizerAccumulation: 0,
        etiolationScore: 0,
      };

      const sortedDates = Array.from(dateStates.keys()).sort(DateUtils.compareDates);

      for (const date of sortedDates) {
        const dayStates = dateStates.get(date) || [];
        context.dailyStates = dayStates;

        let dayRisks: RiskEvent[] = [];

        for (const state of dayStates) {
          const moisturePercent = state.soilMoisturePercent;

          if (moisturePercent >= plant.maxMoisture) {
            context.consecutiveWaterloggingDays += 1/3;
          } else {
            context.consecutiveWaterloggingDays = 0;
          }

          if (moisturePercent <= plant.minMoisture) {
            context.consecutiveLowMoistureDays += 1/3;
          } else {
            context.consecutiveLowMoistureDays = 0;
          }

          const droughtRisk = this.assessDroughtRisk(state, plant, pot, context);
          if (droughtRisk) dayRisks.push(droughtRisk);

          const waterloggingRisk = this.assessWaterloggingRisk(state, plant, pot, context);
          if (waterloggingRisk) dayRisks.push(waterloggingRisk);

          const etiolationRisk = this.assessEtiolationRisk(state, plant, pot, context);
          if (etiolationRisk) dayRisks.push(etiolationRisk);
        }

        const lastState = dayStates[dayStates.length - 1];
        if (lastState) {
          const rootRotRisk = this.assessRootRotRisk(lastState, plant, pot, context);
          if (rootRotRisk) dayRisks.push(rootRotRisk);

          const fertilizerRisk = this.assessFertilizerBurnRisk(lastState, plant, pot, context);
          if (fertilizerRisk) dayRisks.push(fertilizerRisk);
        }

        const uniqueDayRisks = this.deduplicateRisks(dayRisks);
        allRisks.push(...uniqueDayRisks);

        const totalDailyFertilizer = dayStates.reduce((sum, s) => sum + s.fertilizerAmount, 0);
        context.fertilizerAccumulation += totalDailyFertilizer;
      }
    }

    return allRisks;
  }

  groupStatesByPotAndDate(
    states: SimulatedPotState[]
  ): Map<string, Map<string, SimulatedPotState[]>> {
    const result = new Map<string, Map<string, SimulatedPotState[]>>();

    for (const state of states) {
      if (!result.has(state.potId)) {
        result.set(state.potId, new Map());
      }

      const potMap = result.get(state.potId)!;
      if (!potMap.has(state.date)) {
        potMap.set(state.date, []);
      }

      potMap.get(state.date)!.push(state);
    }

    return result;
  }

  deduplicateRisks(risks: RiskEvent[]): RiskEvent[] {
    const seen = new Map<string, RiskEvent>();

    for (const risk of risks) {
      const key = `${risk.potId}-${risk.date}-${risk.riskType}`;

      if (!seen.has(key)) {
        seen.set(key, risk);
      } else {
        const existing = seen.get(key)!;
        if (risk.score > existing.score) {
          seen.set(key, risk);
        }
      }
    }

    return Array.from(seen.values());
  }

  updateSimulationResultWithRisks(
    simulationResult: SimulationResult
  ): SimulationResult {
    const risks = this.assessAllRisks(simulationResult);

    const riskBreakdown: Record<string, number> = {
      drought: 0,
      waterlogging: 0,
      rootRot: 0,
      etiolation: 0,
      fertilizerBurn: 0,
    };

    for (const risk of risks) {
      riskBreakdown[risk.riskType]++;
    }

    return {
      ...simulationResult,
      risks,
      summary: {
        ...simulationResult.summary,
        riskBreakdown: riskBreakdown as any,
      },
    };
  }
}
