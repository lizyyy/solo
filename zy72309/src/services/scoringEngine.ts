import systemStore from '../store/systemStore';
import { generateId, generateBatchNumber } from '../utils/idGenerator';
import { createAuditLog, appendChangeHistory } from '../utils/auditTrail';
import {
  ScoringResult,
  ScoringDetail,
  StudentAnswer,
  ScoringWeightItem,
  AuditAction,
  AnswerReviewStatus
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
      .filter(a => a.reviewStatus === AnswerReviewStatus.APPROVED);

    const results: ScoringResult[] = [];
    for (const answer of approvedAnswers) {
      const existingResult = systemStore.getLatestScoringResultBySubmission(
        answer.submissionId
      );
      const newVersion = (existingResult?.version || 0) + 1;

      const result = this.calculateSingleScore(
        answer,
        weights,
        batchId,
        operator,
        newVersion,
        existingResult
      );

      if (existingResult) {
        result.id = existingResult.id;
        systemStore.updateScoringResult(result);
      } else {
        systemStore.addScoringResult(result);
      }

      results.push(result);

      createAuditLog(
        'result',
        result.id,
        AuditAction.CREATE,
        operator,
        `[${batchId}] 计算 ${answer.studentName}(${answer.submissionId}) 得分: ${result.totalScore}`,
        []
      );
    }

    return { batchId, results };
  }

  private calculateSingleScore(
    answer: StudentAnswer,
    weights: ScoringWeightItem[],
    batchId: string,
    operator: string,
    version: number,
    previousResult?: ScoringResult
  ): ScoringResult {
    const details: ScoringDetail[] = [];
    let totalWeightedScore = 0;

    for (const weight of weights) {
      const rawScore = this.extractAnswerScore(answer, weight.criterionId);
      const weightedScore =
        (rawScore / weight.maxScore) * weight.weight * weight.maxScore;
      const roundedWeighted = Math.round(weightedScore * 100) / 100;

      const prevDetail = previousResult?.details.find(
        d => d.criterionId === weight.criterionId
      );

      details.push({
        criterionId: weight.criterionId,
        criterionName: weight.criterionName,
        score: rawScore,
        originalScore: prevDetail?.score !== undefined ? prevDetail.score : rawScore,
        maxScore: weight.maxScore,
        weight: weight.weight,
        weightedScore: roundedWeighted,
        originalWeightedScore:
          prevDetail?.weightedScore !== undefined
            ? prevDetail.weightedScore
            : roundedWeighted,
        formula: weight.formula,
        notes: this.generateScoreNotes(rawScore, weight),
        correctionNote: weight.correctionReason
      });

      totalWeightedScore += roundedWeighted;
    }

    const roundedTotal = Math.round(totalWeightedScore * 100) / 100;

    return {
      id: generateId(),
      studentId: answer.studentId,
      studentName: answer.studentName,
      submissionId: answer.submissionId,
      totalScore: roundedTotal,
      originalTotalScore:
        previousResult?.totalScore !== undefined
          ? previousResult.totalScore
          : roundedTotal,
      correctedTotalScore: previousResult?.correctedTotalScore,
      details,
      isRecalculated: false,
      calculatedAt: new Date(),
      calculationBatchId: batchId,
      version,
      displayInNormalResults: true,
      changeHistory: previousResult?.changeHistory || []
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
    const notes: string[] = [];
    if (rawScore < weight.maxScore * 0.6) {
      notes.push(`低于及格线(${Math.round(weight.maxScore * 0.6)})`);
    }
    if (rawScore === weight.maxScore) {
      notes.push('满分');
    }
    if (weight.keyNoteRefs && weight.keyNoteRefs.length > 0) {
      notes.push(`含${weight.keyNoteRefs.length}条截图备注`);
    }
    return notes.length > 0 ? notes.join('；') : undefined;
  }

  public recalculateScore(
    submissionId: string,
    reason: string,
    operator: string,
    weightBatchId?: string,
    nextStepContact?: string
  ): ScoringResult | null {
    const answer = systemStore.getStudentAnswersBySubmissionId(submissionId);
    if (!answer) return null;

    const weights = systemStore.getActiveScoringWeights(weightBatchId);
    if (weights.length === 0) {
      throw new Error('没有可用的评分权重配置');
    }

    const existingResult = systemStore.getLatestScoringResultBySubmission(
      submissionId
    );
    const newVersion = (existingResult?.version || 0) + 1;

    const originalTotal = existingResult?.totalScore ?? 0;

    const newResult = this.calculateSingleScore(
      answer,
      weights,
      existingResult?.calculationBatchId || generateBatchNumber('SCORE'),
      operator,
      newVersion,
      existingResult
    );

    if (existingResult) {
      newResult.id = existingResult.id;

      const scoreChanged = existingResult.totalScore !== newResult.totalScore;
      if (scoreChanged) {
        newResult.changeHistory = appendChangeHistory(
          existingResult.changeHistory,
          'totalScore',
          existingResult.totalScore,
          newResult.totalScore,
          operator,
          reason
        );

        newResult.correctedTotalScore = newResult.totalScore;
        newResult.originalTotalScore = existingResult.originalTotalScore || existingResult.totalScore;
      } else {
        newResult.changeHistory = existingResult.changeHistory;
        newResult.originalTotalScore = existingResult.originalTotalScore;
        newResult.correctedTotalScore = existingResult.correctedTotalScore;
      }
    }

    newResult.isRecalculated = true;
    newResult.recalculationReason = reason;
    newResult.recalculatedBy = operator;
    newResult.recalculatedAt = new Date();
    newResult.displayInNormalResults = true;

    if (existingResult) {
      systemStore.updateScoringResult(newResult);
    } else {
      systemStore.addScoringResult(newResult);
    }

    createAuditLog(
      'result',
      newResult.id,
      AuditAction.RECALCULATE,
      operator,
      `重算成绩 ${submissionId}: 原${originalTotal} → 新${newResult.totalScore}，原因: ${reason}`,
      newResult.changeHistory,
      nextStepContact
    );

    return newResult;
  }

  public markResultForReview(
    resultId: string,
    operator: string,
    reason: string,
    nextStepContact?: string
  ): ScoringResult | null {
    const result = systemStore
      .getScoringResults()
      .find(r => r.id === resultId);
    if (!result) return null;

    result.displayInNormalResults = false;
    result.changeHistory = appendChangeHistory(
      result.changeHistory,
      'displayInNormalResults',
      true,
      false,
      operator,
      reason
    );

    systemStore.updateScoringResult(result);

    createAuditLog(
      'result',
      resultId,
      AuditAction.UPDATE,
      operator,
      `标记待复核: ${reason}`,
      result.changeHistory,
      nextStepContact
    );

    return result;
  }

  public getScoringResults(): ScoringResult[] {
    return systemStore.getScoringResults();
  }

  public getScoringResultsByBatch(batchId: string): ScoringResult[] {
    return systemStore.getScoringResultsByBatch(batchId);
  }

  public getScoringResultBySubmission(submissionId: string): ScoringResult | undefined {
    return systemStore.getLatestScoringResultBySubmission(submissionId);
  }

  public getCanonicalScoringResult(
    submissionId: string
  ): ScoringResult | undefined {
    return systemStore.getLatestScoringResultBySubmission(submissionId);
  }

  public getUnifiedScoringData(submissionId: string): {
    result: ScoringResult | undefined;
    answer: StudentAnswer | undefined;
  } {
    return {
      result: systemStore.getLatestScoringResultBySubmission(submissionId),
      answer: systemStore.getStudentAnswersBySubmissionId(submissionId)
    };
  }

  public getScoringAuditTrail(submissionId: string) {
    const result = this.getScoringResultBySubmission(submissionId);
    const answer = systemStore.getStudentAnswersBySubmissionId(submissionId);
    if (!result && !answer) return null;

    const resultLogs = result
      ? systemStore.getAuditLogsByEntity('result', result.id)
      : [];
    const answerLogs = answer
      ? systemStore.getAuditLogsByEntity('answer', answer.id)
      : [];

    return {
      result,
      answer,
      combinedLogs: [...resultLogs, ...answerLogs].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      ),
      resultChangeHistory: result?.changeHistory || [],
      answerChangeHistory: answer?.changeHistory || []
    };
  }
}

export default new ScoringEngine();
