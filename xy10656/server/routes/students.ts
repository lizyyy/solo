import { Router, Request, Response } from 'express';
import * as studentService from '../services/studentService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { search, status, grade } = req.query;
    const students = studentService.getStudents({
      search: search as string,
      status: status as string,
      grade: grade as string,
    });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const student = studentService.getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const student = studentService.createStudent(data, operator);
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const student = studentService.updateStudent(req.params.id, data, operator);
    res.json(student);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    studentService.deleteStudent(req.params.id, operator);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
