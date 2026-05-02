import {
  TrainingSession,
  TrainingPlan,
  ScoreResult,
  ActionResult,
  ChartDataPoint,
  HandActionType,
} from './types';
import {
  SCORE_WEIGHTS,
  MAX_TIMING_TOLERANCE_MS,
  IDEAL_TIMING_TOLERANCE_MS,
  ACTION_TYPE_TO_LABEL,
  HAND_ACTIONS,
} from './constants';
import { calculateAverage, calculateStandardDeviation } from './utils';

export class ScoringEngine {
  private session: TrainingSession;
  private plan: TrainingPlan;

  constructor(session: TrainingSession, plan: TrainingPlan) {
    this.session = session;
    this.plan = plan;
  }

  calculateAccuracy(): number {
    const { totalCorrect, totalIncorrect, totalMissed } = this.session;
    const total = totalCorrect + totalIncorrect + totalMissed;

    if (total === 0) return 0;
    return (totalCorrect / total) * 100;
  }

  calculateTimingScore(): number {
    const validResults = this.session.actionResults.filter(
      (r) => !r.isMissed && r.isCorrect
    );

    if (validResults.length === 0) return 0;

    const timingOffsets = validResults.map((r) => Math.abs(r.timingOffsetMs));
    const avgOffset = calculateAverage(timingOffsets);

    if (avgOffset <= IDEAL_TIMING_TOLERANCE_MS) {
      return 100;
    } else if (avgOffset >= MAX_TIMING_TOLERANCE_MS) {
      return 0;
    } else {
      const ratio =
        (MAX_TIMING_TOLERANCE_MS - avgOffset) /
        (MAX_TIMING_TOLERANCE_MS - IDEAL_TIMING_TOLERANCE_MS);
      return ratio * 100;
    }
  }

  calculateRhythmScore(): number {
    const validResults = this.session.actionResults.filter(
      (r) => !r.isMissed && r.isCorrect
    );

    if (validResults.length < 2) return 100;

    const timingOffsets = validResults.map((r) => r.timingOffsetMs);
    const stdDev = calculateStandardDeviation(timingOffsets);

    const beatMs = (60000 / this.plan.bpm) * 0.3;
    
    if (stdDev <= beatMs) {
      return 100;
    } else if (stdDev >= MAX_TIMING_TOLERANCE_MS) {
      return 0;
    } else {
      const ratio =
        (MAX_TIMING_TOLERANCE_MS - stdDev) /
        (MAX_TIMING_TOLERANCE_MS - beatMs);
      return Math.max(0, ratio * 100);
    }
  }

  calculateOverallScore(): number {
    const accuracy = this.calculateAccuracy();
    const timing = this.calculateTimingScore();
    const rhythm = this.calculateRhythmScore();

    return (
      accuracy * SCORE_WEIGHTS.accuracy +
      timing * SCORE_WEIGHTS.timing +
      rhythm * SCORE_WEIGHTS.rhythm
    );
  }

  getFullScore(): ScoreResult {
    return {
      accuracyPercentage: this.calculateAccuracy(),
      timingScore: this.calculateTimingScore(),
      rhythmScore: this.calculateRhythmScore(),
      overallScore: this.calculateOverallScore(),
      totalActions: this.session.actionResults.length,
      correctActions: this.session.totalCorrect,
      missedActions: this.session.totalMissed,
    };
  }

  getActionAccuracyByStep(): Map<number, { correct: number; total: number; accuracy: number }> {
    const stepStats = new Map<number, { correct: number; total: number; accuracy: number }>();

    const totalSteps = this.plan.steps.length;
    for (let i = 0; i < totalSteps; i++) {
      stepStats.set(i, { correct: 0, total: 0, accuracy: 0 });
    }

    this.session.actionResults.forEach((result) => {
      const stats = stepStats.get(result.stepIndex);
      if (stats) {
        stats.total++;
        if (result.isCorrect && !result.isMissed) {
          stats.correct++;
        }
      }
    });

    stepStats.forEach((stats) => {
      if (stats.total > 0) {
        stats.accuracy = (stats.correct / stats.total) * 100;
      }
    });

    return stepStats;
  }

  getActionTypeStats(): Map<HandActionType, { correct: number; total: number; accuracy: number }> {
    const typeStats = new Map<HandActionType, { correct: number; total: number; accuracy: number }>();

    HAND_ACTIONS.forEach((action) => {
      typeStats.set(action.type, { correct: 0, total: 0, accuracy: 0 });
    });

    this.session.actionResults.forEach((result) => {
      const stats = typeStats.get(result.expectedAction);
      if (stats) {
        stats.total++;
        if (result.isCorrect && !result.isMissed) {
          stats.correct++;
        }
      }
    });

    typeStats.forEach((stats) => {
      if (stats.total > 0) {
        stats.accuracy = (stats.correct / stats.total) * 100;
      }
    });

    return typeStats;
  }

  generateChartData(): ChartDataPoint[] {
    const chartData: ChartDataPoint[] = [];
    const stepStats = this.getActionAccuracyByStep();

    this.plan.steps.forEach((step, index) => {
      const action = HAND_ACTIONS.find((a) => a.id === step.actionId);
      const stats = stepStats.get(index);
      const painAtStep = this.session.painRecords.find((p) => p.stepIndex === index);

      const validResults = this.session.actionResults.filter(
        (r) => r.stepIndex === index && r.isCorrect && !r.isMissed
      );
      const avgTiming =
        validResults.length > 0
          ? calculateAverage(validResults.map((r) => Math.abs(r.timingOffsetMs)))
          : 0;

      chartData.push({
        step: index + 1,
        action: action?.label || '未知',
        accuracy: stats?.accuracy || 0,
        timing: avgTiming,
        pain: painAtStep?.intensity || null,
      });
    });

    return chartData;
  }

  getTimingDistribution(): { early: number; onTime: number; late: number } {
    const validResults = this.session.actionResults.filter(
      (r) => !r.isMissed && r.isCorrect
    );

    let early = 0;
    let onTime = 0;
    let late = 0;

    validResults.forEach((result) => {
      const offset = result.timingOffsetMs;
      if (Math.abs(offset) <= IDEAL_TIMING_TOLERANCE_MS) {
        onTime++;
      } else if (offset < 0) {
        early++;
      } else {
        late++;
      }
    });

    return { early, onTime, late };
  }

  getPainSummary(): {
    totalRecords: number;
    maxIntensity: number;
    avgIntensity: number;
    byStep: Map<number, number[]>;
  } {
    const painRecords = this.session.painRecords;
    
    if (painRecords.length === 0) {
      return {
        totalRecords: 0,
        maxIntensity: 0,
        avgIntensity: 0,
        byStep: new Map(),
      };
    }

    const intensities = painRecords.map((r) => r.intensity);
    const byStep = new Map<number, number[]>();

    painRecords.forEach((r) => {
      if (!byStep.has(r.stepIndex)) {
        byStep.set(r.stepIndex, []);
      }
      byStep.get(r.stepIndex)!.push(r.intensity);
    });

    return {
      totalRecords: painRecords.length,
      maxIntensity: Math.max(...intensities),
      avgIntensity: calculateAverage(intensities),
      byStep,
    };
  }

  getPauseSummary(): {
    totalPauses: number;
    totalPauseDuration: number;
    avgPauseDuration: number;
    byStep: Map<number, number>;
  } {
    const pauseRecords = this.session.pauseRecords;

    if (pauseRecords.length === 0) {
      return {
        totalPauses: 0,
        totalPauseDuration: 0,
        avgPauseDuration: 0,
        byStep: new Map(),
      };
    }

    const durations = pauseRecords.map((r) => r.endTime - r.startTime);
    const byStep = new Map<number, number>();

    pauseRecords.forEach((r) => {
      const duration = r.endTime - r.startTime;
      if (!byStep.has(r.stepIndex)) {
        byStep.set(r.stepIndex, 0);
      }
      byStep.set(r.stepIndex, byStep.get(r.stepIndex)! + duration);
    });

    return {
      totalPauses: pauseRecords.length,
      totalPauseDuration: durations.reduce((a, b) => a + b, 0),
      avgPauseDuration: calculateAverage(durations),
      byStep,
    };
  }
}
