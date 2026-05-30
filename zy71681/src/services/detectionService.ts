import { v4 as uuidv4 } from 'uuid';
import { runQuery, allQuery, getQuery } from '../database';
import { DetectionIssue, QuestionType } from '../types';

const ENHARMONIC_MAP: Record<string, string[]> = {
  'C#': ['Db'],
  'Db': ['C#'],
  'D#': ['Eb'],
  'Eb': ['D#'],
  'F#': ['Gb'],
  'Gb': ['F#'],
  'G#': ['Ab'],
  'Ab': ['G#'],
  'A#': ['Bb'],
  'Bb': ['A#'],
  'B#': ['C'],
  'C': ['B#'],
  'Cb': ['B'],
  'B': ['Cb'],
  'E#': ['F'],
  'F': ['E#'],
  'Fb': ['E'],
  'E': ['Fb']
};

export const detectEnharmonicMismatch = (
  studentAnswer: string,
  standardAnswer: string
): { isMismatch: boolean; equivalentAnswer?: string } => {
  if (studentAnswer === standardAnswer) {
    return { isMismatch: false };
  }

  const studentNorm = studentAnswer.trim();
  const standardNorm = standardAnswer.trim();

  const studentEquivalents = ENHARMONIC_MAP[studentNorm] || [];
  const standardEquivalents = ENHARMONIC_MAP[standardNorm] || [];

  if (studentEquivalents.includes(standardNorm) || standardEquivalents.includes(studentNorm)) {
    return {
      isMismatch: true,
      equivalentAnswer: studentNorm
    };
  }

  const studentNotes = studentNorm.split(/[,\s]+/);
  const standardNotes = standardNorm.split(/[,\s]+/);

  if (studentNotes.length === standardNotes.length) {
    let allEquivalent = true;
    for (let i = 0; i < studentNotes.length; i++) {
      const sNote = studentNotes[i];
      const stdNote = standardNotes[i];
      if (sNote !== stdNote) {
        const sEquiv = ENHARMONIC_MAP[sNote] || [];
        const stdEquiv = ENHARMONIC_MAP[stdNote] || [];
        if (!sEquiv.includes(stdNote) && !stdEquiv.includes(sNote)) {
          allEquivalent = false;
          break;
        }
      }
    }
    if (allEquivalent) {
      return {
        isMismatch: true,
        equivalentAnswer: studentNorm
      };
    }
  }

  return { isMismatch: false };
};

export const detectTypeMismatch = async (
  questionId: string,
  expectedType: QuestionType
): Promise<{ isMismatch: boolean; actualType?: string }> => {
  const row = await getQuery<{ type: string }>(
    'SELECT type FROM questions WHERE id = ?',
    [questionId]
  );

  if (row && row.type !== expectedType) {
    return {
      isMismatch: true,
      actualType: row.type
    };
  }

  return { isMismatch: false };
};

export const detectDuplicateSubmission = async (
  studentId: string,
  questionId: string,
  practiceDate: string,
  currentSubmissionId?: string
): Promise<{ isDuplicate: boolean; existingSubmissionId?: string }> => {
  const rows = await allQuery<{ id: string }>(
    `SELECT id FROM answer_submissions 
     WHERE student_id = ? AND question_id = ? AND practice_date = ?
     ${currentSubmissionId ? 'AND id != ?' : ''}`,
    currentSubmissionId
      ? [studentId, questionId, practiceDate, currentSubmissionId]
      : [studentId, questionId, practiceDate]
  );

  if (rows.length > 0) {
    return {
      isDuplicate: true,
      existingSubmissionId: rows[0].id
    };
  }

  return { isDuplicate: false };
};

export const createDetectionIssue = async (
  type: DetectionIssue['type'],
  description: string,
  details: Record<string, any>,
  submissionId?: string,
  questionId?: string
): Promise<DetectionIssue> => {
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  await runQuery(
    `INSERT INTO detection_issues (id, type, submission_id, question_id, description, details, is_resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, type, submissionId, questionId, description, JSON.stringify(details), createdAt]
  );

  return {
    id,
    type,
    submissionId,
    questionId,
    description,
    details,
    isResolved: false,
    createdAt
  };
};

export const resolveDetectionIssue = async (issueId: string): Promise<void> => {
  const resolvedAt = new Date().toISOString();
  await runQuery(
    'UPDATE detection_issues SET is_resolved = 1, resolved_at = ? WHERE id = ?',
    [resolvedAt, issueId]
  );
};

export const getDetectionIssues = async (
  isResolved?: boolean,
  type?: DetectionIssue['type'],
  limit: number = 100
): Promise<DetectionIssue[]> => {
  let sql = `SELECT id, type, submission_id as submissionId, question_id as questionId,
                    description, details, is_resolved as isResolved, created_at as createdAt, resolved_at as resolvedAt
             FROM detection_issues WHERE 1=1`;
  const params: any[] = [];

  if (isResolved !== undefined) {
    sql += ' AND is_resolved = ?';
    params.push(isResolved ? 1 : 0);
  }

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = await allQuery(sql, params);

  return rows.map((row: any) => ({
    ...row,
    isResolved: row.isResolved === 1,
    details: JSON.parse(row.details)
  })) as DetectionIssue[];
};

export const runAllDetectionsForSubmission = async (
  submissionId: string,
  studentId: string,
  questionId: string,
  studentAnswer: string,
  standardAnswer: string,
  practiceDate: string,
  questionType: QuestionType
): Promise<DetectionIssue[]> => {
  const issues: DetectionIssue[] = [];

  const enharmonicResult = detectEnharmonicMismatch(studentAnswer, standardAnswer);
  if (enharmonicResult.isMismatch) {
    const issue = await createDetectionIssue(
      'enharmonic_mismatch',
      `检测到等音误判: 学生答案"${studentAnswer}"与标准答案"${standardAnswer}"为等音关系`,
      {
        studentAnswer,
        standardAnswer,
        equivalentAnswer: enharmonicResult.equivalentAnswer
      },
      submissionId,
      questionId
    );
    issues.push(issue);
  }

  const duplicateResult = await detectDuplicateSubmission(studentId, questionId, practiceDate, submissionId);
  if (duplicateResult.isDuplicate) {
    const issue = await createDetectionIssue(
      'duplicate_submission',
      `检测到重复提交: 该学生此题已存在提交记录`,
      {
        studentId,
        questionId,
        practiceDate,
        existingSubmissionId: duplicateResult.existingSubmissionId
      },
      submissionId,
      questionId
    );
    issues.push(issue);
  }

  return issues;
};
