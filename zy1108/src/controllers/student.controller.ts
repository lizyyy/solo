import { Request, Response } from 'express';
import { StudentService, PackageService } from '../services';
import { wrapAsync } from '../middleware/error-handler';

export class StudentController {
  private readonly studentService: StudentService;
  private readonly packageService: PackageService;

  constructor() {
    this.studentService = new StudentService();
    this.packageService = new PackageService();
  }

  create = wrapAsync(async (req: Request, res: Response) => {
    const { name, phone, guardian_name, guardian_phone, gender, birth_date, notes } = req.body;
    const student = await this.studentService.createStudent({
      name,
      phone,
      guardian_name,
      guardian_phone,
      gender,
      birth_date,
      notes,
    });
    res.json({ success: true, data: student });
  });

  update = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const student = await this.studentService.updateStudent(id, req.body);
    res.json({ success: true, data: student });
  });

  getById = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const student = await this.studentService.getStudent(id);
    const packages = await this.packageService.getStudentBalances(id);
    res.json({ 
      success: true, 
      data: { 
        ...student, 
        packages 
      } 
    });
  });

  getAll = wrapAsync(async (req: Request, res: Response) => {
    const { active, q } = req.query;
    let students;
    if (q && typeof q === 'string') {
      students = await this.studentService.searchStudents(q);
    } else if (active === 'true') {
      students = await this.studentService.getActiveStudents();
    } else {
      students = await this.studentService.getAllStudents();
    }
    res.json({ success: true, data: students });
  });

  deactivate = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const student = await this.studentService.deactivateStudent(id);
    res.json({ success: true, data: student });
  });

  activate = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const student = await this.studentService.activateStudent(id);
    res.json({ success: true, data: student });
  });

  getBalances = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const balances = await this.packageService.getStudentBalances(id);
    res.json({ success: true, data: balances });
  });
}
