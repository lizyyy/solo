import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const students = db.getAllStudents();
  res.success(students);
});

router.get('/:id', (req: Request, res: Response) => {
  const student = db.getStudentById(req.params.id);
  if (!student) {
    return res.notFound('学员不存在');
  }
  res.success(student);
});

router.post('/', (req: Request, res: Response) => {
  const { name, idCard, phone, email, course, operator } = req.body;
  
  if (!name || !idCard || !phone || !course) {
    return res.error('MISSING_FIELDS', '请填写必填字段');
  }

  const existing = db.getStudentByIdCard(idCard);
  if (existing) {
    return res.error('DUPLICATE_IDCARD', '该身份证号已存在');
  }

  const student = db.createStudent({ name, idCard, phone, email, course }, operator || 'system');
  res.success(student);
});

router.put('/:id', (req: Request, res: Response) => {
  const { operator, ...data } = req.body;
  const student = db.updateStudent(req.params.id, data, operator || 'system');
  
  if (!student) {
    return res.notFound('学员不存在');
  }
  res.success(student);
});

export default router;
