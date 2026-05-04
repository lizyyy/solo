import { Request, Response } from 'express';
import { TeacherService } from '../services';
import { wrapAsync } from '../middleware/error-handler';

export class TeacherController {
  private readonly service: TeacherService;

  constructor() {
    this.service = new TeacherService();
  }

  create = wrapAsync(async (req: Request, res: Response) => {
    const { name, phone, email, hourly_rate } = req.body;
    const teacher = await this.service.createTeacher({
      name,
      phone,
      email,
      hourly_rate: hourly_rate ? Number(hourly_rate) : undefined,
    });
    res.json({ success: true, data: teacher });
  });

  update = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const teacher = await this.service.updateTeacher(id, req.body);
    res.json({ success: true, data: teacher });
  });

  getById = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const teacher = await this.service.getTeacher(id);
    res.json({ success: true, data: teacher });
  });

  getAll = wrapAsync(async (req: Request, res: Response) => {
    const { active } = req.query;
    let teachers;
    if (active === 'true') {
      teachers = await this.service.getActiveTeachers();
    } else {
      teachers = await this.service.getAllTeachers();
    }
    res.json({ success: true, data: teachers });
  });

  deactivate = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const teacher = await this.service.deactivateTeacher(id);
    res.json({ success: true, data: teacher });
  });

  activate = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const teacher = await this.service.activateTeacher(id);
    res.json({ success: true, data: teacher });
  });
}
