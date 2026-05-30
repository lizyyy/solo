import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery } from '../database';
import {
  Class,
  Student,
  Question,
  AnswerSubmission,
  QuestionType,
  SubmissionStatus,
  ImportResult,
  SupplementData
} from '../types';
import { createAuditLog } from './auditService';
import { runAllDetectionsForSubmission } from './detectionService';

export const createClass = async (name: string, operator?: string): Promise<Class> => {
  const id = uuidv4();
  const now = new Date().toISOString();

  await runQuery(
    'INSERT INTO classes (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, name, now, now]
  );

  await createAuditLog('class', id, 'create', `创建班级: ${name}`, undefined, undefined, name, operator);

  return { id, name, createdAt: now, updatedAt: now };
};

export const getClassById = async (id: string): Promise<Class | undefined> => {
  const row = await getQuery<{ id: string; name: string; created_at: string; updated_at: string }>(
    'SELECT id, name, created_at, updated_at FROM classes WHERE id = ?',
    [id]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export const getAllClasses = async (): Promise<Class[]> => {
  const rows = await allQuery<{ id: string; name: string; created_at: string; updated_at: string }>(
    'SELECT id, name, created_at, updated_at FROM classes ORDER BY created_at DESC'
  );
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

export const createStudent = async (
  classId: string,
  name: string,
  studentNo: string,
  operator?: string
): Promise<Student> => {
  const id = uuidv4();
  const now = new Date().toISOString();

  await runQuery(
    'INSERT INTO students (id, class_id, name, student_no, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, classId, name, studentNo, now, now]
  );

  await createAuditLog('student', id, 'create', `创建学生: ${name} (${studentNo})`, undefined, undefined, name, operator);

  return { id, classId, name, studentNo, createdAt: now, updatedAt: now };
};

export const getStudentById = async (id: string): Promise<Student | undefined> => {
  const row = await getQuery<{ id: string; class_id: string; name: string; student_no: string; created_at: string; updated_at: string }>(
    'SELECT id, class_id, name, student_no, created_at, updated_at FROM students WHERE id = ?',
    [id]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    classId: row.class_id,
    name: row.name,
    studentNo: row.student_no,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export const getStudentsByClass = async (classId: string): Promise<Student[]> => {
  const rows = await allQuery<{ id: string; class_id: string; name: string; student_no: string; created_at: string; updated_at: string }>(
    'SELECT id, class_id, name, student_no, created_at, updated_at FROM students WHERE class_id = ? ORDER BY student_no',
    [classId]
  );
  return rows.map(row => ({
    id: row.id,
    classId: row.class_id,
    name: row.name,
    studentNo: row.student_no,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

export const createQuestion = async (
  practiceDate: string,
  type: QuestionType,
  questionNo: number,
  standardAnswer: string,
  description?: string,
  operator?: string
): Promise<Question> => {
  const id = uuidv4();
  const now = new Date().toISOString();

  await runQuery(
    `INSERT INTO questions (id, practice_date, type, question_no, standard_answer, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, practiceDate, type, questionNo, standardAnswer, description || null, now, now]
  );

  await createAuditLog(
    'question',
    id,
    'create',
    `创建题目: ${type} 第${questionNo}题 (${practiceDate})`,
    undefined,
    undefined,
    standardAnswer,
    operator
  );

  return { id, practiceDate, type, questionNo, standardAnswer, description, createdAt: now, updatedAt: now };
};

export const getQuestionById = async (id: string): Promise<Question | undefined> => {
  const row = await getQuery<{
    id: string;
    practice_date: string;
    type: string;
    question_no: number;
    standard_answer: string;
    description?: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, practice_date, type, question_no, standard_answer, description, created_at, updated_at
     FROM questions WHERE id = ?`,
    [id]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    practiceDate: row.practice_date,
    type: row.type as QuestionType,
    questionNo: row.question_no,
    standardAnswer: row.standard_answer,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export const getQuestionsByDate = async (practiceDate: string, type?: QuestionType): Promise<Question[]> => {
  let sql = `SELECT id, practice_date, type, question_no, standard_answer, description, created_at, updated_at
             FROM questions WHERE practice_date = ?`;
  const params: any[] = [practiceDate];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY question_no';

  const rows = await allQuery<{
    id: string;
    practice_date: string;
    type: string;
    question_no: number;
    standard_answer: string;
    description?: string;
    created_at: string;
    updated_at: string;
  }>(sql, params);

  return rows.map(row => ({
    id: row.id,
    practiceDate: row.practice_date,
    type: row.type as QuestionType,
    questionNo: row.question_no,
    standardAnswer: row.standard_answer,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

export const generateIdempotencyKey = (
  studentId: string,
  questionId: string,
  practiceDate: string
): string => {
  return `${studentId}-${questionId}-${practiceDate}`;
};

export const createSubmission = async (
  studentId: string,
  questionId: string,
  studentAnswer: string,
  practiceDate: string,
  notes?: string,
  operator?: string
): Promise<AnswerSubmission | null> => {
  const idempotencyKey = generateIdempotencyKey(studentId, questionId, practiceDate);

  const existing = await getQuery<{ id: string; student_answer: string }>(
    'SELECT id, student_answer FROM answer_submissions WHERE idempotency_key = ?',
    [idempotencyKey]
  );

  if (existing) {
    return null;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const status: SubmissionStatus = 'pending';

  await runQuery(
    `INSERT INTO answer_submissions 
     (id, student_id, question_id, student_answer, practice_date, submitted_at, status, idempotency_key, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, studentId, questionId, studentAnswer, practiceDate, now, status, idempotencyKey, notes || null]
  );

  await createAuditLog(
    'submission',
    id,
    'create',
    `创建答案提交`,
    'studentAnswer',
    undefined,
    studentAnswer,
    operator
  );

  return {
    id,
    studentId,
    questionId,
    studentAnswer,
    practiceDate,
    submittedAt: now,
    status,
    idempotencyKey,
    notes
  };
};

export const getSubmissionById = async (id: string): Promise<AnswerSubmission | undefined> => {
  const row = await getQuery<{
    id: string;
    student_id: string;
    question_id: string;
    student_answer: string;
    practice_date: string;
    submitted_at: string;
    graded_at?: string;
    is_correct?: number;
    score?: number;
    status: string;
    idempotency_key: string;
    notes?: string;
  }>(
    `SELECT id, student_id, question_id, student_answer, practice_date, submitted_at,
            graded_at, is_correct, score, status, idempotency_key, notes
     FROM answer_submissions WHERE id = ?`,
    [id]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    studentId: row.student_id,
    questionId: row.question_id,
    studentAnswer: row.student_answer,
    practiceDate: row.practice_date,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    isCorrect: row.is_correct === 1,
    score: row.score,
    status: row.status as SubmissionStatus,
    idempotencyKey: row.idempotency_key,
    notes: row.notes
  };
};

export const getSubmissionsByDate = async (practiceDate: string): Promise<AnswerSubmission[]> => {
  const rows = await allQuery<{
    id: string;
    student_id: string;
    question_id: string;
    student_answer: string;
    practice_date: string;
    submitted_at: string;
    graded_at?: string;
    is_correct?: number;
    score?: number;
    status: string;
    idempotency_key: string;
    notes?: string;
  }>(
    `SELECT id, student_id, question_id, student_answer, practice_date, submitted_at,
            graded_at, is_correct, score, status, idempotency_key, notes
     FROM answer_submissions WHERE practice_date = ? ORDER BY submitted_at DESC`,
    [practiceDate]
  );

  return rows.map(row => ({
    id: row.id,
    studentId: row.student_id,
    questionId: row.question_id,
    studentAnswer: row.student_answer,
    practiceDate: row.practice_date,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    isCorrect: row.is_correct === 1,
    score: row.score,
    status: row.status as SubmissionStatus,
    idempotencyKey: row.idempotency_key,
    notes: row.notes
  }));
};

export const gradeSubmission = async (
  submissionId: string,
  isCorrect: boolean,
  score: number,
  operator?: string
): Promise<AnswerSubmission | undefined> => {
  const submission = await getSubmissionById(submissionId);
  if (!submission) return undefined;

  const gradedAt = new Date().toISOString();
  const status: SubmissionStatus = 'graded';

  await runQuery(
    `UPDATE answer_submissions 
     SET is_correct = ?, score = ?, graded_at = ?, status = ?
     WHERE id = ?`,
    [isCorrect ? 1 : 0, score, gradedAt, status, submissionId]
  );

  await createAuditLog(
    'submission',
    submissionId,
    'grade',
    `判分完成: ${isCorrect ? '正确' : '错误'}, 得分: ${score}`,
    undefined,
    undefined,
    JSON.stringify({ isCorrect, score }),
    operator
  );

  return {
    ...submission,
    isCorrect,
    score,
    gradedAt,
    status
  };
};

export const autoGradeSubmission = async (
  submissionId: string,
  operator?: string
): Promise<{ submission: AnswerSubmission; issues: any[] } | undefined> => {
  const submission = await getSubmissionById(submissionId);
  if (!submission) return undefined;

  const question = await getQuestionById(submission.questionId);
  if (!question) return undefined;

  const issues = await runAllDetectionsForSubmission(
    submissionId,
    submission.studentId,
    submission.questionId,
    submission.studentAnswer,
    question.standardAnswer,
    submission.practiceDate,
    question.type
  );

  const isCorrect = submission.studentAnswer.trim() === question.standardAnswer.trim();
  const score = isCorrect ? 100 : 0;

  const gradedSubmission = await gradeSubmission(submissionId, isCorrect, score, operator);

  return {
    submission: gradedSubmission!,
    issues
  };
};

export const supplementData = async (
  data: SupplementData
): Promise<void> => {
  const { entityType, entityId, fieldName, value, operator } = data;

  const fieldMap: Record<string, Record<string, string>> = {
    submission: {
      notes: 'notes',
      studentAnswer: 'student_answer'
    },
    question: {
      standardAnswer: 'standard_answer',
      description: 'description'
    },
    student: {
      name: 'name',
      studentNo: 'student_no'
    },
    class: {
      name: 'name'
    }
  };

  const tableMap: Record<string, string> = {
    submission: 'answer_submissions',
    question: 'questions',
    student: 'students',
    class: 'classes'
  };

  const table = tableMap[entityType];
  const dbField = fieldMap[entityType]?.[fieldName] || fieldName;

  if (!table) {
    throw new Error(`不支持的实体类型: ${entityType}`);
  }

  const oldRow = await getQuery<any>(`SELECT ${dbField} as old_value FROM ${table} WHERE id = ?`, [entityId]);
  const oldValue = oldRow?.old_value?.toString() || '';

  await runQuery(`UPDATE ${table} SET ${dbField} = ? WHERE id = ?`, [value, entityId]);

  await createAuditLog(
    entityType,
    entityId,
    'supplement',
    `补充/修改 ${fieldName}: ${oldValue} -> ${value}`,
    fieldName,
    oldValue,
    value,
    operator
  );
};

export const importSubmissionWithCheck = async (
  studentId: string,
  questionId: string,
  studentAnswer: string,
  practiceDate: string,
  isCorrect?: boolean,
  score?: number,
  notes?: string,
  operator?: string
): Promise<ImportResult> => {
  const idempotencyKey = generateIdempotencyKey(studentId, questionId, practiceDate);

  const existing = await getQuery<{
    id: string;
    student_answer: string;
    is_correct?: number;
    score?: number;
    notes?: string;
  }>(
    `SELECT id, student_answer, is_correct, score, notes
     FROM answer_submissions WHERE idempotency_key = ?`,
    [idempotencyKey]
  );

  if (existing) {
    const conflicts: string[] = [];

    if (existing.student_answer !== studentAnswer) {
      conflicts.push(`学生答案不一致: 原有"${existing.student_answer}", 新的"${studentAnswer}"`);
    }

    if (isCorrect !== undefined && existing.is_correct !== undefined && existing.is_correct !== (isCorrect ? 1 : 0)) {
      conflicts.push(`判分结果不一致: 原有"${existing.is_correct ? '正确' : '错误'}", 新的"${isCorrect ? '正确' : '错误'}"`);
    }

    if (score !== undefined && existing.score !== undefined && existing.score !== score) {
      conflicts.push(`分数不一致: 原有"${existing.score}", 新的"${score}"`);
    }

    if (conflicts.length > 0) {
      return {
        type: 'conflict',
        entityId: existing.id,
        message: '存在冲突，需要人工确认',
        conflicts
      };
    }

    const hasUpdates =
      (notes !== undefined && existing.notes !== notes) ||
      (isCorrect !== undefined && existing.is_correct === undefined) ||
      (score !== undefined && existing.score === undefined);

    if (hasUpdates) {
      const updates: string[] = [];
      if (notes !== undefined && existing.notes !== notes) {
        updates.push('备注');
      }
      if (isCorrect !== undefined && existing.is_correct === undefined) {
        updates.push('判分结果');
      }
      if (score !== undefined && existing.score === undefined) {
        updates.push('分数');
      }

      const gradedAt = new Date().toISOString();
      await runQuery(
        `UPDATE answer_submissions 
         SET is_correct = COALESCE(?, is_correct),
             score = COALESCE(?, score),
             notes = COALESCE(?, notes),
             graded_at = ?,
             status = ?
         WHERE id = ?`,
        [
          isCorrect !== undefined ? (isCorrect ? 1 : 0) : null,
          score !== undefined ? score : null,
          notes !== undefined ? notes : null,
          gradedAt,
          isCorrect !== undefined ? 'graded' : 'pending',
          existing.id
        ]
      );

      await createAuditLog(
        'submission',
        existing.id,
        'update',
        `更新提交数据: ${updates.join(', ')}`,
        undefined,
        undefined,
        JSON.stringify({ isCorrect, score, notes }),
        operator
      );

      return {
        type: 'updated',
        entityId: existing.id,
        message: `已更新: ${updates.join(', ')}`
      };
    }

    return {
      type: 'duplicate',
      entityId: existing.id,
      message: '数据完全相同，跳过'
    };
  }

  const submission = await createSubmission(studentId, questionId, studentAnswer, practiceDate, notes, operator);

  if (submission && (isCorrect !== undefined || score !== undefined)) {
    await gradeSubmission(submission.id, isCorrect ?? false, score ?? 0, operator);
  }

  return {
    type: 'created',
    entityId: submission!.id,
    message: '创建新记录'
  };
};
