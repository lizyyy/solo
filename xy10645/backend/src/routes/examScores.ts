import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const examScores = db.getAllExamScores();
  res.success(examScores);
});

router.get('/student/:studentId', (req: Request, res: Response) => {
  const examScores = db.getExamScoreByStudentId(req.params.studentId);
  res.success(examScores);
});

router.post('/', (req: Request, res: Response) => {
  const { studentId, examType, score, fullScore, passScore, examDate, operator } = req.body;
  
  if (!studentId || !examType || score === undefined || !fullScore || !passScore || !examDate) {
    return res.error('MISSING_FIELDS', '请填写必填字段');
  }

  if (score < 0 || score > fullScore) {
    return res.error('INVALID_SCORE', '成绩必须在0到满分之间');
  }

  const student = db.getStudentById(studentId);
  if (!student) {
    return res.error('STUDENT_NOT_FOUND', '学员不存在');
  }

  const examScore = db.createExamScore({ 
    studentId, examType, score, fullScore, passScore, examDate, createdBy: operator || 'system' 
  }, operator || 'system');
  
  res.success(examScore);
});

router.put('/:id', (req: Request, res: Response) => {
  const { operator, ...data } = req.body;
  
  if (data.score !== undefined && data.fullScore !== undefined && data.score > data.fullScore) {
    return res.error('INVALID_SCORE', '成绩不能超过满分');
  }

  const examScore = db.updateExamScore(req.params.id, data, operator || 'system');
  
  if (!examScore) {
    return res.notFound('考试成绩不存在');
  }
  res.success(examScore);
});

export default router;
