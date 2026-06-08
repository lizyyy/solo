import systemStore from '../store/systemStore';
import { buildVersionList } from '../utils/auditTrail';
import {
  UnifiedViewRecord,
  AnswerReviewStatus,
  ScoringResult,
  StudentAnswer,
  ConflictRecord,
  ScoringDetail
} from '../types';

export class UnifiedDataService {
  private getCanonicalAnswer(submissionId: string): StudentAnswer | undefined {
    return systemStore.getStudentAnswersBySubmissionId(submissionId);
  }

  private getCanonicalResult(submissionId: string): ScoringResult | undefined {
    return systemStore.getLatestScoringResultBySubmission(submissionId);
  }

  private getRelatedConflicts(studentId: string, submissionId: string): ConflictRecord[] {
    return systemStore
      .getConflictRecords()
      .filter(
        c =>
          c.relatedEntityId === submissionId ||
          (c.type === 'duplicate_student_answer' &&
            c.evidence.some(e =>
              typeof e.actualValue === 'string' &&
              typeof e.expectedValue === 'string' &&
              (e.actualValue.includes(studentId) ||
                e.expectedValue.includes(studentId) ||
                e.actualValue === submissionId ||
                e.expectedValue === submissionId)
            ))
      );
  }

  public getUnifiedRecord(submissionId: string): UnifiedViewRecord | null {
    const answer = this.getCanonicalAnswer(submissionId);
    if (!answer) return null;

    const result = this.getCanonicalResult(submissionId);
    const conflicts = this.getRelatedConflicts(answer.studentId, submissionId);
    const pendingConflict = conflicts.find(c => c.status === 'pending');

    const displayStatus = this.determineDisplayStatus(
      answer,
      result,
      !!pendingConflict
    );

    const scoreDetails = result
      ? result.details
      : this.buildPlaceholderDetails(answer);

    const answerLogs = buildVersionList(answer, 'answer');
    const resultLogs = result ? buildVersionList(result, 'result') : [];
    const allVersions = [...answerLogs, ...resultLogs].sort(
      (a, b) => a.operatedAt.getTime() - b.operatedAt.getTime()
    );

    const lastVersion = allVersions[allVersions.length - 1] || {
      version: 1,
      operator: 'system',
      operatedAt: answer.createdAt,
      summary: '导入初始答案'
    };

    return {
      submissionId,
      studentId: answer.studentId,
      studentName: answer.studentName,
      displayStatus,
      statusText: this.getStatusText(displayStatus),
      totalScore: result?.totalScore ?? 0,
      originalTotalScore: result?.originalTotalScore,
      isRecalculated: result?.isRecalculated ?? false,
      needsReview: answer.reviewStatus === AnswerReviewStatus.PENDING_REVIEW,
      reviewStatus: answer.reviewStatus,
      scoreDetails,
      answerData: {
        currentAnswers: answer.answers,
        originalAnswers: answer.originalAnswers,
        correctedAnswers: answer.correctedAnswers
      },
      auditInfo: {
        originalStatement: pendingConflict?.originalStatement,
        correctedStatement: pendingConflict?.correctedStatement,
        processingReason:
          pendingConflict?.processingReason ||
          answer.correctionReason ||
          result?.recalculationReason,
        nextStepContact:
          pendingConflict?.nextStepContact || answer.nextStepContact,
        lastOperator: lastVersion.operator,
        lastOperatedAt: lastVersion.operatedAt,
        allVersions: allVersions.map((v, idx) => ({
          ...v,
          version: idx + 1
        }))
      },
      conflictInfo: {
        hasConflict: conflicts.length > 0,
        conflictType: conflicts[0]?.type,
        conflictStatus: conflicts[0]?.status
      },
      exportReady:
        answer.reviewStatus === AnswerReviewStatus.APPROVED &&
        (pendingConflict?.status !== 'pending')
    };
  }

  private buildPlaceholderDetails(answer: StudentAnswer): ScoringDetail[] {
    const weights = systemStore.getActiveScoringWeights();
    return weights.map(w => ({
      criterionId: w.criterionId,
      criterionName: w.criterionName,
      score: answer.answers[w.criterionId] ?? 0,
      maxScore: w.maxScore,
      weight: w.weight,
      weightedScore: 0,
      formula: w.formula,
      notes: '待评分'
    }));
  }

  private determineDisplayStatus(
    answer: StudentAnswer,
    result: ScoringResult | undefined,
    hasPendingConflict: boolean
  ): UnifiedViewRecord['displayStatus'] {
    if (answer.reviewStatus === AnswerReviewStatus.PENDING_REVIEW || hasPendingConflict) {
      return 'pending_review';
    }
    if (result?.isRecalculated) {
      return 'recalculated';
    }
    if (
      answer.correctedAnswers ||
      result?.originalTotalScore !== undefined
    ) {
      return 'corrected';
    }
    return 'normal';
  }

  private getStatusText(
    status: UnifiedViewRecord['displayStatus']
  ): string {
    const map: Record<UnifiedViewRecord['displayStatus'], string> = {
      normal: '正常',
      pending_review: '待复核',
      corrected: '已修正',
      recalculated: '已重算'
    };
    return map[status];
  }

  public getUnifiedList(): UnifiedViewRecord[] {
    const answers = systemStore.getStudentAnswers();
    const records: UnifiedViewRecord[] = [];

    for (const answer of answers) {
      const record = this.getUnifiedRecord(answer.submissionId);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  public getSummary(): {
    total: number;
    normal: number;
    pendingReview: number;
    corrected: number;
    recalculated: number;
    averageScore: number;
    exportReadyCount: number;
    pendingConflictCount: number;
  } {
    const list = this.getUnifiedList();
    const summary = {
      total: list.length,
      normal: 0,
      pendingReview: 0,
      corrected: 0,
      recalculated: 0,
      averageScore: 0,
      exportReadyCount: 0,
      pendingConflictCount: 0
    };

    let scoreSum = 0;
    let scoredCount = 0;

    for (const rec of list) {
      summary[rec.displayStatus === 'normal' ? 'normal' :
              rec.displayStatus === 'pending_review' ? 'pendingReview' :
              rec.displayStatus === 'corrected' ? 'corrected' : 'recalculated']++;
      if (rec.exportReady) summary.exportReadyCount++;
      if (rec.conflictInfo.hasConflict && rec.conflictInfo.conflictStatus === 'pending') {
        summary.pendingConflictCount++;
      }
      if (rec.totalScore > 0) {
        scoreSum += rec.totalScore;
        scoredCount++;
      }
    }

    summary.averageScore = scoredCount > 0
      ? Math.round((scoreSum / scoredCount) * 100) / 100
      : 0;

    return summary;
  }

  public verifyAllConsistency(): Array<{
    submissionId: string;
    studentName: string;
    issues: string[];
  }> {
    const list = this.getUnifiedList();
    const allIssues: Array<{
      submissionId: string;
      studentName: string;
      issues: string[];
    }> = [];

    for (const rec of list) {
      const issues: string[] = [];
      const answer = this.getCanonicalAnswer(rec.submissionId);
      const result = this.getCanonicalResult(rec.submissionId);

      if (answer && result) {
        if (answer.studentId !== result.studentId) {
          issues.push(`studentId不一致: ${answer.studentId} vs ${result.studentId}`);
        }
        if (answer.studentName !== result.studentName) {
          issues.push(`studentName不一致`);
        }
      }

      if (answer && answer.reviewStatus === AnswerReviewStatus.APPROVED) {
        if (answer.correctedAnswers && !answer.reviewNotes) {
          issues.push('有修正答案但缺少复核备注');
        }
      }

      if (result && result.isRecalculated) {
        if (!result.recalculationReason) {
          issues.push('重算但缺少原因');
        }
        if (!result.recalculatedBy) {
          issues.push('重算但缺少操作人');
        }
      }

      if (issues.length > 0) {
        allIssues.push({
          submissionId: rec.submissionId,
          studentName: rec.studentName,
          issues
        });
      }
    }

    return allIssues;
  }

  public getSingleSource(submissionId: string): {
    list: UnifiedViewRecord;
    detail: UnifiedViewRecord;
    summaryIncludes: boolean;
  } {
    const record = this.getUnifiedRecord(submissionId);
    if (!record) {
      throw new Error(`记录不存在: ${submissionId}`);
    }
    const list = this.getUnifiedList();
    const summary = this.getSummary();
    return {
      list: record,
      detail: record,
      summaryIncludes:
        (record.displayStatus === 'normal' && summary.normal > 0) ||
        (record.displayStatus === 'pending_review' && summary.pendingReview > 0) ||
        (record.displayStatus === 'corrected' && summary.corrected > 0) ||
        (record.displayStatus === 'recalculated' && summary.recalculated > 0)
    };
  }
}

export default new UnifiedDataService();
