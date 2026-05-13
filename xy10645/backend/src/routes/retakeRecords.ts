import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const retakeRecords = db.getAllRetakeRecords();
  res.success(retakeRecords);
});

router.get('/student/:studentId', (req: Request, res: Response) => {
  const retakeRecords = db.getRetakeRecordByStudentId(req.params.studentId);
  res.success(retakeRecords);
});

router.post('/', (req: Request, res: Response) => {
  const { studentId, originalExamId, retakeCount, retakeDate, score, isPassed, operator } = req.body;
  
  if (!studentId || !originalExamId || retakeCount === undefined || !retakeDate || score === undefined) {
    return res.error('MISSING_FIELDS', '请填写必填字段');
  }

  const student = db.getStudentById(studentId);
  if (!student) {
    return res.error('STUDENT_NOT_FOUND', '学员不存在');
  }

  const retakeRecord = db.createRetakeRecord({ 
    studentId, originalExamId, retakeCount, retakeDate, score, isPassed: isPassed ?? false, createdBy: operator || 'system' 
  }, operator || 'system');
  
  res.success(retakeRecord);
});

router.put('/:id', (req: Request, res: Response) => {
  const { operator, ...data } = req.body;
  const retakeRecord = db.updateRetakeRecord(req.params.id, data, operator || 'system');
  
  if (!retakeRecord) {
    return res.notFound('补考记录不存在');
  }
  res.success(retakeRecord);
});

export default router;
