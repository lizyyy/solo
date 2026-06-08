import systemStore from '../store/systemStore';
import { generateId } from '../utils/idGenerator';
import { createAuditLog, appendChangeHistory } from '../utils/auditTrail';
import {
  StudentAnswer,
  AnswerReviewStatus,
  ConflictRecord,
  ConflictType,
  ConflictStatus,
  DataSource,
  AuditAction
} from '../types';

export class StudentAnswerService {
  public addStudentAnswer(
    studentId: string,
    studentName: string,
    submissionId: string,
    answers: Record<string, any>,
    operator: string = 'system'
  ): { answer: StudentAnswer; conflicts: ConflictRecord[] } {
    const existingAnswers = systemStore.getStudentAnswersByStudentId(studentId);
    const isResubmission = existingAnswers.length > 0;
    const previousSubmissions = existingAnswers.map(a => a.submissionId);
    const allSubmissionIds = [...previousSubmissions, submissionId];

    const answer: StudentAnswer = {
      id: generateId(),
      studentId,
      studentName,
      submissionId,
      submissionTime: new Date(),
      answers: { ...answers },
      originalAnswers: isResubmission ? existingAnswers[existingAnswers.length - 1].answers : { ...answers },
      isResubmission,
      previousSubmissionId: isResubmission
        ? existingAnswers[existingAnswers.length - 1].submissionId
        : undefined,
      allSubmissionIds,
      reviewStatus: isResubmission
        ? AnswerReviewStatus.PENDING_REVIEW
        : AnswerReviewStatus.APPROVED,
      createdAt: new Date(),
      changeHistory: []
    };

    if (!isResubmission) {
      answer.originalAnswers = { ...answers };
    }

    systemStore.addStudentAnswer(answer);

    createAuditLog(
      'answer',
      answer.id,
      isResubmission ? AuditAction.SUPPLEMENT : AuditAction.CREATE,
      operator,
      isResubmission
        ? `学生${studentName}补交/重交答案（第${allSubmissionIds.length}版），待业务运营复核`
        : `导入学生${studentName}答案（首次提交）`,
      [],
      isResubmission ? '业务运营' : undefined
    );

    const conflicts: ConflictRecord[] = [];
    if (isResubmission) {
      const conflict = this.createDuplicateAnswerConflict(answer, operator);
      conflicts.push(conflict);
    }

    return { answer, conflicts };
  }

  private createDuplicateAnswerConflict(
    answer: StudentAnswer,
    operator: string
  ): ConflictRecord {
    const prevSubmissionId = answer.previousSubmissionId;
    const prevAnswer = prevSubmissionId
      ? systemStore.getStudentAnswersBySubmissionId(prevSubmissionId)
      : undefined;

    const diffFields = prevAnswer
      ? this.computeAnswerDifferences(prevAnswer.answers, answer.answers)
      : [];

    const conflict: ConflictRecord = {
      id: generateId(),
      type: ConflictType.DUPLICATE_STUDENT_ANSWER,
      relatedEntityType: 'answer',
      relatedEntityId: answer.id,
      title: `学生${answer.studentName}重复提交答案`,
      description: `提交了${answer.allSubmissionIds.length}版答案，差异字段: ${diffFields.join(', ') || '未检出'}`,
      originalStatement: prevSubmissionId
        ? `前一版(${prevSubmissionId}): ${JSON.stringify(prevAnswer?.answers || {})}`
        : '无前版记录',
      evidence: [
        {
          source: DataSource.WEIGHT_TABLE,
          fieldName: 'submissionId',
          originalValue: prevSubmissionId,
          currentValue: answer.submissionId,
          expectedValue: prevSubmissionId,
          actualValue: answer.submissionId,
          location: `学生ID: ${answer.studentId}`
        },
        {
          source: DataSource.WEIGHT_TABLE,
          fieldName: 'answers',
          originalValue: prevAnswer?.answers,
          currentValue: answer.answers,
          expectedValue: prevAnswer?.answers,
          actualValue: answer.answers,
          location: `差异: ${diffFields.join(', ') || '无'}`
        }
      ],
      status: ConflictStatus.PENDING,
      createdAt: new Date(),
      changeHistory: [],
      nextStepContact: '请业务运营复核确认使用哪一版答案'
    };

    systemStore.addConflictRecord(conflict);

    createAuditLog(
      'conflict',
      conflict.id,
      AuditAction.CREATE,
      operator,
      `触发重复提交冲突: 学生${answer.studentName}(${answer.studentId})`,
      [],
      conflict.nextStepContact
    );

    return conflict;
  }

  private computeAnswerDifferences(
    a: Record<string, any>,
    b: Record<string, any>
  ): string[] {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const diffs: string[] = [];
    for (const k of keys) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        diffs.push(k);
      }
    }
    return diffs;
  }

  public correctStudentAnswers(
    answerId: string,
    correctedAnswers: Record<string, any>,
    correctionReason: string,
    operator: string,
    nextStepContact?: string
  ): StudentAnswer | null {
    const answer = systemStore
      .getStudentAnswers()
      .find(a => a.id === answerId);
    if (!answer) return null;

    const originalAnswers = { ...answer.answers };
    const diffs = this.computeAnswerDifferences(originalAnswers, correctedAnswers);

    for (const field of diffs) {
      answer.changeHistory = appendChangeHistory(
        answer.changeHistory,
        `answers.${field}`,
        originalAnswers[field],
        correctedAnswers[field],
        operator,
        correctionReason
      );
    }

    if (!answer.correctedAnswers) {
      answer.correctedAnswers = { ...correctedAnswers };
    } else {
      answer.correctedAnswers = { ...answer.correctedAnswers, ...correctedAnswers };
    }

    answer.answers = { ...correctedAnswers };
    answer.correctionReason = correctionReason;
    if (nextStepContact) {
      answer.nextStepContact = nextStepContact;
    }

    if (diffs.length > 0) {
      answer.reviewStatus = AnswerReviewStatus.PENDING_REVIEW;
    }

    systemStore.updateStudentAnswer(answer);

    createAuditLog(
      'answer',
      answerId,
      AuditAction.SUPPLEMENT,
      operator,
      `补录修正答案，修改字段: ${diffs.join(', ') || '无'}，原因: ${correctionReason}`,
      answer.changeHistory,
      nextStepContact || (diffs.length > 0 ? '业务运营复核' : undefined)
    );

    return answer;
  }

  public reviewStudentAnswer(
    answerId: string,
    status: AnswerReviewStatus,
    reviewedBy: string,
    notes?: string,
    nextStepContact?: string,
    processingReason?: string
  ): StudentAnswer | null {
    const answers = systemStore.getStudentAnswers();
    const answer = answers.find(a => a.id === answerId);
    if (!answer) return null;

    const originalStatus = answer.reviewStatus;
    if (originalStatus !== status) {
      answer.changeHistory = appendChangeHistory(
        answer.changeHistory,
        'reviewStatus',
        originalStatus,
        status,
        reviewedBy,
        notes || processingReason || '业务复核'
      );
    }

    answer.reviewStatus = status;
    answer.reviewedBy = reviewedBy;
    answer.reviewedAt = new Date();
    answer.reviewNotes = notes;
    if (nextStepContact) {
      answer.nextStepContact = nextStepContact;
    }

    systemStore.updateStudentAnswer(answer);

    const relatedConflict = this.resolveRelatedConflict(
      answer,
      status,
      reviewedBy,
      notes,
      processingReason,
      nextStepContact
    );

    createAuditLog(
      'answer',
      answerId,
      AuditAction.REVIEW,
      reviewedBy,
      `复核完成: ${originalStatus} → ${status}; ${processingReason || notes || ''}`,
      answer.changeHistory,
      nextStepContact
    );

    return answer;
  }

  private resolveRelatedConflict(
    answer: StudentAnswer,
    status: AnswerReviewStatus,
    reviewedBy: string,
    notes?: string,
    processingReason?: string,
    nextStepContact?: string
  ): ConflictRecord | undefined {
    const conflicts = systemStore.getConflictRecords();
    const relatedConflict = conflicts.find(
      c =>
        c.type === ConflictType.DUPLICATE_STUDENT_ANSWER &&
        (c.relatedEntityId === answer.id ||
          c.evidence.some(
            e =>
              typeof e.actualValue === 'string' && e.actualValue === answer.submissionId
          ))
    );

    if (relatedConflict) {
      const originalStatus = relatedConflict.status;
      if (originalStatus !== ConflictStatus.PENDING) return relatedConflict;

      const newStatus =
        status === AnswerReviewStatus.REJECTED
          ? ConflictStatus.REJECTED
          : ConflictStatus.CONFIRMED;

      relatedConflict.changeHistory = appendChangeHistory(
        relatedConflict.changeHistory,
        'status',
        originalStatus,
        newStatus,
        reviewedBy,
        processingReason || notes || ''
      );

      relatedConflict.status = newStatus;
      relatedConflict.resolvedBy = reviewedBy;
      relatedConflict.resolvedAt = new Date();
      relatedConflict.resolutionNotes = notes;
      relatedConflict.processingReason = processingReason;
      relatedConflict.correctedStatement =
        status === AnswerReviewStatus.APPROVED
          ? `已确认使用当前版本(${answer.submissionId})`
          : `已驳回，保留前一版`;
      if (nextStepContact) {
        relatedConflict.nextStepContact = nextStepContact;
      }

      systemStore.updateConflictRecord(relatedConflict);

      createAuditLog(
        'conflict',
        relatedConflict.id,
        AuditAction.CONFLICT_RESOLVE,
        reviewedBy,
        `冲突处理: ${originalStatus} → ${newStatus}; ${processingReason || notes || ''}`,
        relatedConflict.changeHistory,
        nextStepContact
      );
    }

    return relatedConflict;
  }

  public getStudentAnswers(): StudentAnswer[] {
    return systemStore.getStudentAnswers();
  }

  public getAnswersByStudentId(studentId: string): StudentAnswer[] {
    return systemStore.getStudentAnswersByStudentId(studentId);
  }

  public getAnswerBySubmissionId(submissionId: string): StudentAnswer | undefined {
    return systemStore.getStudentAnswersBySubmissionId(submissionId);
  }

  public getAnswersPendingReview(): StudentAnswer[] {
    return systemStore
      .getStudentAnswers()
      .filter(a => a.reviewStatus === AnswerReviewStatus.PENDING_REVIEW);
  }

  public getAnswerAuditTrail(answerId: string) {
    const answer = systemStore.getStudentAnswers().find(a => a.id === answerId);
    if (!answer) return null;

    const auditLogs = systemStore.getAuditLogsByEntity('answer', answerId);
    const conflicts = systemStore.getConflictsByEntity('answer', answerId);
    return {
      answer,
      auditLogs,
      conflicts,
      changeHistory: answer.changeHistory
    };
  }
}

export default new StudentAnswerService();
