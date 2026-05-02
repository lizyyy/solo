import {
  ScoreResult,
  ScoreBreakdown,
  Risk,
  RiskType,
  TrayCoverage,
  DailyConsumption,
} from '../models/types.js';

export interface ScoringInput {
  trayCoverages: TrayCoverage[];
  consumption: DailyConsumption;
  risks: Risk[];
  dailyBudget: number;
}

export interface ScoringConfig {
  coverageWeight: number;
  costWeight: number;
  heatWeight: number;
  scheduleWeight: number;
  budgetThreshold: number;
}

const DEFAULT_CONFIG: ScoringConfig = {
  coverageWeight: 40,
  costWeight: 25,
  heatWeight: 20,
  scheduleWeight: 15,
  budgetThreshold: 0.8,
};

export class Scorer {
  private config: ScoringConfig;

  constructor(config?: Partial<ScoringConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  score(input: ScoringInput): ScoreResult {
    const coverageScore = this.calculateCoverageScore(input);
    const costScore = this.calculateCostScore(input);
    const heatScore = this.calculateHeatScore(input);
    const scheduleScore = this.calculateScheduleScore(input);

    const total = coverageScore + costScore + heatScore + scheduleScore;
    const maxTotal = this.config.coverageWeight +
      this.config.costWeight +
      this.config.heatWeight +
      this.config.scheduleWeight;

    const letterGrade = this.getLetterGrade(total, maxTotal);

    return {
      total,
      breakdown: {
        coverage: coverageScore,
        costEfficiency: costScore,
        heatRisk: heatScore,
        scheduling: scheduleScore,
      },
      maxTotal,
      letterGrade,
    };
  }

  private calculateCoverageScore(input: ScoringInput): number {
    const maxWeight = this.config.coverageWeight;

    if (input.trayCoverages.length === 0) {
      return 0;
    }

    const avgCoverageRatio = input.trayCoverages.reduce((sum, t) => {
      return sum + t.coverageRatio;
    }, 0) / input.trayCoverages.length;

    let penalty = 0;
    const darkZoneRisks = input.risks.filter(r => r.type === RiskType.DARK_ZONE);
    
    for (const risk of darkZoneRisks) {
      if (risk.severity === 'high') {
        penalty += maxWeight * 0.15;
      } else if (risk.severity === 'medium') {
        penalty += maxWeight * 0.08;
      }
    }

    const baseScore = avgCoverageRatio * maxWeight;
    return Math.max(0, Math.min(maxWeight, baseScore - penalty));
  }

  private calculateCostScore(input: ScoringInput): number {
    const maxWeight = this.config.costWeight;

    if (input.dailyBudget <= 0) {
      return maxWeight * 0.5;
    }

    const budgetRatio = input.consumption.totalCost / input.dailyBudget;

    let score: number;

    if (budgetRatio <= this.config.budgetThreshold) {
      score = maxWeight;
    } else if (budgetRatio <= 1.0) {
      const t = (budgetRatio - this.config.budgetThreshold) / (1 - this.config.budgetThreshold);
      score = maxWeight * (1 - 0.3 * t);
    } else {
      const excessRatio = Math.min(budgetRatio - 1.0, 2.0);
      score = maxWeight * 0.7 * (1 - excessRatio / 2);
    }

    const budgetRisks = input.risks.filter(r => r.type === RiskType.BUDGET_EXCEEDED);
    for (const risk of budgetRisks) {
      if (risk.severity === 'high') {
        score = Math.max(0, score - maxWeight * 0.2);
      }
    }

    const overlapRisks = input.risks.filter(r => r.type === RiskType.OVERLAP_WASTE);
    for (const risk of overlapRisks) {
      if (risk.severity === 'medium') {
        score = Math.max(0, score - maxWeight * 0.05);
      }
    }

    return Math.max(0, Math.min(maxWeight, score));
  }

  private calculateHeatScore(input: ScoringInput): number {
    const maxWeight = this.config.heatWeight;

    const heatRisks = input.risks.filter(r => r.type === RiskType.HEAT_RISK);

    if (heatRisks.length === 0) {
      return maxWeight;
    }

    let penalty = 0;
    const seenTrays = new Set<string>();

    for (const risk of heatRisks) {
      const trayId = risk.details?.trayId as string;
      
      if (risk.severity === 'high') {
        penalty += maxWeight * 0.25;
        if (trayId && !seenTrays.has(trayId)) {
          penalty += maxWeight * 0.1;
          seenTrays.add(trayId);
        }
      } else if (risk.severity === 'medium') {
        penalty += maxWeight * 0.12;
      } else {
        penalty += maxWeight * 0.05;
      }
    }

    return Math.max(0, Math.min(maxWeight, maxWeight - penalty));
  }

  private calculateScheduleScore(input: ScoringInput): number {
    const maxWeight = this.config.scheduleWeight;

    const timeConflicts = input.risks.filter(r => r.type === RiskType.TIME_CONFLICT);

    if (timeConflicts.length === 0) {
      return maxWeight;
    }

    let penalty = 0;

    for (const conflict of timeConflicts) {
      if (conflict.severity === 'high') {
        penalty += maxWeight * 0.2;
      } else if (conflict.severity === 'medium') {
        penalty += maxWeight * 0.1;
      } else {
        penalty += maxWeight * 0.05;
      }
    }

    return Math.max(0, Math.min(maxWeight, maxWeight - penalty));
  }

  private getLetterGrade(score: number, maxScore: number): string {
    const percentage = score / maxScore;

    if (percentage >= 0.95) return 'S';
    if (percentage >= 0.90) return 'A+';
    if (percentage >= 0.85) return 'A';
    if (percentage >= 0.80) return 'A-';
    if (percentage >= 0.75) return 'B+';
    if (percentage >= 0.70) return 'B';
    if (percentage >= 0.65) return 'B-';
    if (percentage >= 0.60) return 'C+';
    if (percentage >= 0.55) return 'C';
    if (percentage >= 0.50) return 'C-';
    if (percentage >= 0.40) return 'D';

    return 'F';
  }

  getWeightBreakdown(): { category: string; weight: number; maxScore: number }[] {
    return [
      { category: '覆盖率', weight: this.config.coverageWeight, maxScore: this.config.coverageWeight },
      { category: '费用效率', weight: this.config.costWeight, maxScore: this.config.costWeight },
      { category: '温升风险', weight: this.config.heatWeight, maxScore: this.config.heatWeight },
      { category: '排程', weight: this.config.scheduleWeight, maxScore: this.config.scheduleWeight },
    ];
  }
}
