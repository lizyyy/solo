import { allQuery, getQuery } from '../database';
import { ClassStatistics, TypeStats, QuestionType } from '../types';
import * as XLSX from 'xlsx';

const calculateTypeStats = (
  questions: any[],
  submissions: any[],
  type: QuestionType
): TypeStats => {
  const typeQuestions = questions.filter((q: any) => q.type === type);
  const typeSubmissions = submissions.filter((s: any) =>
    typeQuestions.some((q: any) => q.id === s.question_id) && s.is_correct !== undefined
  );

  const totalQuestions = typeQuestions.length;
  const correctCount = typeSubmissions.filter((s: any) => s.is_correct === 1).length;
  const totalAttempts = typeSubmissions.length;

  return {
    totalQuestions,
    correctCount,
    accuracy: totalAttempts > 0 ? correctCount / totalAttempts : 0,
    averageScore: totalAttempts > 0
      ? typeSubmissions.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / totalAttempts
      : 0
  };
};

export const getClassStatistics = async (
  classId: string,
  practiceDate: string
): Promise<ClassStatistics | null> => {
  const classRow = await getQuery<{ id: string; name: string }>(
    'SELECT id, name FROM classes WHERE id = ?',
    [classId]
  );

  if (!classRow) return null;

  const students = await allQuery<{ id: string }>(
    'SELECT id FROM students WHERE class_id = ?',
    [classId]
  );

  const questions = await allQuery<{ id: string; type: string }>(
    'SELECT id, type FROM questions WHERE practice_date = ?',
    [practiceDate]
  );

  const studentIds = students.map(s => s.id);

  const submissions = await allQuery(
    `SELECT s.question_id, s.is_correct, s.score
     FROM answer_submissions s
     WHERE s.student_id IN (${studentIds.map(() => '?').join(',')}) 
       AND s.practice_date = ?`,
    [...studentIds, practiceDate]
  );

  const submittedStudentIds = new Set(
    (await allQuery<{ student_id: string }>(
      `SELECT DISTINCT student_id 
       FROM answer_submissions 
       WHERE student_id IN (${studentIds.map(() => '?').join(',')}) 
         AND practice_date = ?`,
      [...studentIds, practiceDate]
    )).map(s => s.student_id)
  );

  const intervalStats = calculateTypeStats(questions, submissions, 'interval');
  const rhythmStats = calculateTypeStats(questions, submissions, 'rhythm');
  const melodyStats = calculateTypeStats(questions, submissions, 'melody');

  const allStats = [intervalStats, rhythmStats, melodyStats];
  const totalCorrect = allStats.reduce((sum, s) => sum + s.correctCount, 0);
  const totalAttempts = submissions.length;

  return {
    classId: classRow.id,
    className: classRow.name,
    practiceDate,
    totalStudents: students.length,
    submittedCount: submittedStudentIds.size,
    averageScore: totalAttempts > 0
      ? submissions.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / totalAttempts
      : 0,
    intervalStats,
    rhythmStats,
    melodyStats
  };
};

export const getStudentScores = async (
  classId: string,
  practiceDate: string
): Promise<any[]> => {
  const students = await allQuery<{ id: string; name: string; student_no: string }>(
    'SELECT id, name, student_no FROM students WHERE class_id = ? ORDER BY student_no',
    [classId]
  );

  const questions = await allQuery<{ id: string; type: string; question_no: number; standard_answer: string }>(
    'SELECT id, type, question_no, standard_answer FROM questions WHERE practice_date = ? ORDER BY type, question_no',
    [practiceDate]
  );

  const results = [];

  for (const student of students) {
    const submissions = await allQuery<{
      question_id: string;
      student_answer: string;
      is_correct: number;
      score: number;
    }>(
      `SELECT question_id, student_answer, is_correct, score
       FROM answer_submissions
       WHERE student_id = ? AND practice_date = ?`,
      [student.id, practiceDate]
    );

    const submissionMap = new Map(submissions.map(s => [s.question_id, s]));

    const studentResult: any = {
      studentNo: student.student_no,
      name: student.name
    };

    let totalScore = 0;
    let answeredCount = 0;

    for (const question of questions) {
      const submission = submissionMap.get(question.id);
      const key = `${question.type}_${question.question_no}`;

      if (submission) {
        studentResult[`${key}_answer`] = submission.student_answer;
        studentResult[`${key}_correct`] = submission.is_correct === 1 ? '是' : '否';
        studentResult[`${key}_score`] = submission.score;
        totalScore += submission.score || 0;
        answeredCount++;
      } else {
        studentResult[`${key}_answer`] = '';
        studentResult[`${key}_correct`] = '';
        studentResult[`${key}_score`] = '';
      }
      studentResult[`${key}_standard`] = question.standard_answer;
    }

    studentResult.totalScore = totalScore;
    studentResult.answeredCount = answeredCount;
    studentResult.totalQuestions = questions.length;

    results.push(studentResult);
  }

  return results;
};

export const exportToExcel = async (
  classId: string,
  practiceDate: string
): Promise<Buffer> => {
  const stats = await getClassStatistics(classId, practiceDate);
  const studentScores = await getStudentScores(classId, practiceDate);

  const wb = XLSX.utils.book_new();

  if (stats) {
    const statsData = [
      ['班级统计报告'],
      ['班级', stats.className],
      ['练习日期', stats.practiceDate],
      ['学生总数', stats.totalStudents],
      ['已提交人数', stats.submittedCount],
      ['平均分', stats.averageScore.toFixed(2)],
      [],
      ['题型统计'],
      ['题型', '题目数', '正确数', '正确率', '平均分'],
      ['音程', stats.intervalStats.totalQuestions, stats.intervalStats.correctCount,
        (stats.intervalStats.accuracy * 100).toFixed(1) + '%', stats.intervalStats.averageScore.toFixed(2)],
      ['节奏', stats.rhythmStats.totalQuestions, stats.rhythmStats.correctCount,
        (stats.rhythmStats.accuracy * 100).toFixed(1) + '%', stats.rhythmStats.averageScore.toFixed(2)],
      ['旋律', stats.melodyStats.totalQuestions, stats.melodyStats.correctCount,
        (stats.melodyStats.accuracy * 100).toFixed(1) + '%', stats.melodyStats.averageScore.toFixed(2)]
    ];

    const statsWs = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, statsWs, '统计概览');
  }

  if (studentScores.length > 0) {
    const scoresWs = XLSX.utils.json_to_sheet(studentScores);
    XLSX.utils.book_append_sheet(wb, scoresWs, '学生成绩');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

export const getWrongQuestionsByType = async (
  classId: string,
  practiceDate: string,
  type: QuestionType
): Promise<any[]> => {
  const students = await allQuery<{ id: string; name: string }>(
    'SELECT id, name FROM students WHERE class_id = ?',
    [classId]
  );

  const studentIds = students.map(s => s.id);
  const studentMap = new Map(students.map(s => [s.id, s.name]));

  const questions = await allQuery<{
    id: string;
    question_no: number;
    standard_answer: string;
  }>(
    'SELECT id, question_no, standard_answer FROM questions WHERE practice_date = ? AND type = ?',
    [practiceDate, type]
  );

  const results = [];

  for (const question of questions) {
    const wrongSubmissions = await allQuery<{
      student_id: string;
      student_answer: string;
    }>(
      `SELECT student_id, student_answer
       FROM answer_submissions
       WHERE question_id = ? AND is_correct = 0`,
      [question.id]
    );

    for (const submission of wrongSubmissions) {
      results.push({
        questionNo: question.question_no,
        standardAnswer: question.standard_answer,
        studentName: studentMap.get(submission.student_id),
        studentAnswer: submission.student_answer
      });
    }
  }

  return results;
};
