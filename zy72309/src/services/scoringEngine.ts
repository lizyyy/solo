import systemStore from '../store/systemStore';
import { generateId, generateBatchNumber } from '../utils/idGenerator';
import {
  ScoringResult,
  ScoringDetail,
  StudentAnswer,
  ScoringWeightItem
} from '../types';

export class ScoringEngine {
  public calculateScores(
    operator: string,
    weightBatchId?: string
  ): { batchId: string; results: ScoringResult[] } {
    const weights = systemStore.getActiveScoringWeights(weightBatchId);
    if (weights.length === 0) {
      throw new Error('没有可用的评分权重配置');
    }

    const batchId = generateBatchNumber('SCORE');
    const approvedAnswers = systemStore
      .getStudentAnswers()
      .filter(a => a.reviewStatus === 'approved');

    const results: ScoringResult[] = [];
    for (const answer of approvedAnswers) {
      const result = this.calculateSingleScore(answer, weights, batchId, operator);
      results.push(result);
      systemStore.addScoringResult(result);
    }

    return { batchId, results };
  }

  private calculateSingleScore(
    answer: StudentAnswer,
    weights: ScoringWeightItem[],
    batchId: string,
    operator: string
  ): ScoringResult {
    const details: ScoringDetail[] = [];
    let totalWeightedScore = 0;

    for (const weight of weights) {
      const rawScore = this.extractAnswerScore(answer, weight.criterionId);
      const weightedScore = (rawScore / weight.maxScore) * weight.weight * weight.maxScore;

      details.push({
        criterionId: weight.criterionId,
        criterionName: weight.criterionName,
        score: rawScore,
        maxScore: weight.maxScore,
        weight: weight.weight,
        weightedScore: Math.round(weightedScore * 100) / 100,
        formula: weight.formula,
        notes: this.generateScoreNotes(rawScore, weight)
      });

      totalWeightedScore += weightedScore;
    }

    return {
      id: generateId(),
      studentId: answer.studentId,
      studentName: answer.studentName,
      submissionId: answer.submissionId,
      totalScore: Math.round(totalWeightedScore * 100) / 100,
      details,
      isRecalculated: false,
      calculatedAt: new Date(),
      calculationBatchId: batchId
    };
  }

  private extractAnswerScore(
    answer: StudentAnswer,
    criterionId: string
  ): number {
    const value = answer.answers[criterionId];
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
  }

  private generateScoreNotes(
    rawScore: number,
    weight: ScoringWeightItem
  ): string | undefined {
    if (rawScore < weight.maxScore * 0.6) {
      return `分数低于及格线(${Math.round(weight.maxScore * 0.6)})`;
    }
    if (rawScore === weight.maxScore) {
      return '满分';
    }
    return undefined;
  }

  public recalculateScore(
    submissionId: string,
    reason: string,
    operator: string,
    weightBatchId?: string
  ): ScoringResult | null {
    const answer = systemStore.getStudentAnswersBySubmissionId(submissionId);
    if (!answer) return null;

    const weights = systemStore.getActiveScoringWeights(weightBatchId);
    if (weights.length === 0) {
      throw new Error('没有可用的评分权重配置');
    }

    const existingResult = systemStore.getScoringResultBySubmission(submissionId);
    const newResult = this.calculateSingleScore(
      answer,
      weights,
      existingResult?.calculationBatchId || generateBatchNumber('SCORE'),
      operator
    );

    newResult.id = existingResult?.id || generateId();
    newResult.isRecalculated = true;
    newResult.recalculationReason = reason;
    newResult.recalculatedBy = operator;
    newResult.recalculatedAt = new Date();

    if (existingResult) {
      systemStore.updateScoringResult(newResult);
    } else {
      systemStore.addScoringResult(newResult);
    }

    return newResult;
  }

  public getScoringResults(): ScoringResult[] {
    return systemStore.getScoringResults();
  }

  public getScoringResultsByBatch(batchId: string): ScoringResult[] {
    return systemStore.getScoringResultsByBatch(batchId);
  }

  public getScoringResultBySubmission(submissionId: string): ScoringResult | undefined {
    return systemStore.getScoringResultBySubmission(submissionId);
  }

  public getUnifiedScoringData(
    submissionId: string
  ): {
    result: ScoringResult | undefined;
    answer: StudentAnswer | undefined;
  } {
    return {
      result: systemStore.getScoringResultBySubmission(submissionId),
      answer: systemStore.getStudentAnswersBySubmissionId(submissionId)
    };
  }
}

export default new ScoringEngine();
