import {
  LightingScenario,
  EvaluationResult,
} from '../models/types.js';
import { IlluminanceCalculator } from './illuminance-calculator.js';
import { CostCalculator } from './cost-calculator.js';
import { RiskAssessor } from './risk-assessor.js';
import { Scorer } from './scorer.js';

export class Evaluator {
  private illuminanceCalculator: IlluminanceCalculator;
  private costCalculator: CostCalculator;
  private riskAssessor: RiskAssessor;
  private scorer: Scorer;

  constructor() {
    this.illuminanceCalculator = new IlluminanceCalculator();
    this.costCalculator = new CostCalculator();
    this.riskAssessor = new RiskAssessor();
    this.scorer = new Scorer();
  }

  evaluate(scenario: LightingScenario): EvaluationResult {
    const trayCoverages = this.illuminanceCalculator.calculateAllTrayCoverages(scenario);

    const totalPoints = trayCoverages.reduce((sum, t) => sum + t.totalPoints, 0);
    const coveredPoints = trayCoverages.reduce((sum, t) => sum + t.coveredPoints, 0);
    const overallCoverage = {
      totalPoints,
      coveredPoints,
      coverageRatio: totalPoints > 0 ? coveredPoints / totalPoints : 0,
    };

    const consumption = this.costCalculator.calculateDailyConsumption(scenario);

    const risks = this.riskAssessor.assess({
      scenario,
      trayCoverages,
      consumption,
    });

    const score = this.scorer.score({
      trayCoverages,
      consumption,
      risks,
      dailyBudget: scenario.electricity.dailyBudget,
    });

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      trayCoverages,
      overallCoverage,
      consumption,
      risks,
      score,
    };
  }

  evaluateMultiple(scenarios: LightingScenario[]): EvaluationResult[] {
    return scenarios.map(s => this.evaluate(s));
  }
}
