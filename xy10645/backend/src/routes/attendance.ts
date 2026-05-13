import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const attendances = db.getAllAttendances();
  res.success(attendances);
});

router.get('/student/:studentId', (req: Request, res: Response) => {
  const attendances = db.getAttendanceByStudentId(req.params.studentId);
  res.success(attendances);
});

router.post('/', (req: Request, res: Response) => {
  const { studentId, date, status, remark, operator } = req.body;
  
  if (!studentId || !date || !status) {
    return res.error('MISSING_FIELDS', '请填写必填字段');
  }

  const student = db.getStudentById(studentId);
  if (!student) {
    return res.error('STUDENT_NOT_FOUND', '学员不存在');
  }

  const attendance = db.createAttendance({ studentId, date, status, remark, createdBy: operator || 'system' }, operator || 'system');
  res.success(attendance);
});

router.put('/:id', (req: Request, res: Response) => {
  const { operator, ...data } = req.body;
  const attendance = db.updateAttendance(req.params.id, data, operator || 'system');
  
  if (!attendance) {
    return res.notFound('出勤记录不存在');
  }
  res.success(attendance);
});

export default router;
