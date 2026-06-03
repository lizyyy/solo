import systemStore from '../store/systemStore';
import { generateId } from '../utils/idGenerator';
import {
  StudentAnswer,
  AnswerReviewStatus,
  ConflictRecord,
  ConflictType,
  ConflictStatus,
  DataSource
} from '../types';

export class StudentAnswerService {
  public addStudentAnswer(
    studentId: string,
    studentName: string,
    submissionId: string,
    answers: Record<string, any>
  ): { answer: StudentAnswer; conflicts: ConflictRecord[] } {
    const existingAnswers = systemStore.getStudentAnswersByStudentId(studentId);
    const isResubmission = existingAnswers.length > 0;

    const answer: StudentAnswer = {
      id: generateId(),
      studentId,
      studentName,
      submissionId,
      submissionTime: new Date(),
      answers,
      isResubmission,
      previousSubmissionId: isResubmission
        ? existingAnswers[existingAnswers.length - 1].submissionId
        : undefined,
      reviewStatus: isResubmission
        ? AnswerReviewStatus.PENDING_REVIEW
        : AnswerReviewStatus.APPROVED,
      createdAt: new Date()
    };

    systemStore.addStudentAnswer(answer);

    const conflicts: ConflictRecord[] = [];
    if (isResubmission) {
      const conflict = this.createDuplicateAnswerConflict(answer);
      conflicts.push(conflict);
    }

    return { answer, conflicts };
  }

  private createDuplicateAnswerConflict(answer: StudentAnswer): ConflictRecord {
    const conflict: ConflictRecord = {
      id: generateId(),
      type: ConflictType.DUPLICATE_STUDENT_ANSWER,
      title: `学生重复提交答案`,
      description: `学生"${answer.studentName}"(ID: ${answer.studentId})提交了多版答案`,
      evidence: [
        {
          source: DataSource.WEIGHT_TABLE,
          fieldName: 'submissionId',
          expectedValue: answer.previousSubmissionId,
          actualValue: answer.submissionId,
          location: `学生ID: ${answer.studentId}`
        }
      ],
      status: ConflictStatus.PENDING,
      createdAt: new Date()
    };

    systemStore.addConflictRecord(conflict);
    return conflict;
  }

  public reviewStudentAnswer(
    answerId: string,
    status: AnswerReviewStatus,
    reviewedBy: string,
    notes?: string
  ): StudentAnswer | null {
    const answers = systemStore.getStudentAnswers();
    const answer = answers.find(a => a.id === answerId);
    if (!answer) return null;

    answer.reviewStatus = status;
    answer.reviewedBy = reviewedBy;
    answer.reviewedAt = new Date();
    answer.reviewNotes = notes;

    systemStore.updateStudentAnswer(answer);

    this.resolveRelatedConflict(answer);

    return answer;
  }

  private resolveRelatedConflict(answer: StudentAnswer): void {
    const conflicts = systemStore.getConflictRecords();
    const relatedConflict = conflicts.find(
      c =>
        c.type === ConflictType.DUPLICATE_STUDENT_ANSWER &&
        c.evidence.some(e => e.actualValue === answer.submissionId)
    );

    if (relatedConflict) {
      relatedConflict.status =
        answer.reviewStatus === AnswerReviewStatus.APPROVED
          ? ConflictStatus.CONFIRMED
          : ConflictStatus.REJECTED;
      relatedConflict.resolvedBy = answer.reviewedBy;
      relatedConflict.resolvedAt = new Date();
      relatedConflict.resolutionNotes = answer.reviewNotes;

      systemStore.updateConflictRecord(relatedConflict);
    }
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
}

export default new StudentAnswerService();
