import { Request, Response } from 'express';
import { ClassService } from '../services';
import { wrapAsync } from '../middleware/error-handler';

export class ClassController {
  private readonly service: ClassService;

  constructor() {
    this.service = new ClassService();
  }

  create = wrapAsync(async (req: Request, res: Response) => {
    const { name, teacher_id, dance_style, capacity, description } = req.body;
    const cls = await this.service.createClass({
      name,
      teacher_id,
      dance_style,
      capacity: capacity ? Number(capacity) : undefined,
      description,
    });
    res.json({ success: true, data: cls });
  });

  update = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const cls = await this.service.updateClass(id, req.body);
    res.json({ success: true, data: cls });
  });

  getById = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const cls = await this.service.getClass(id);
    res.json({ success: true, data: cls });
  });

  getAll = wrapAsync(async (req: Request, res: Response) => {
    const { active, teacher_id } = req.query;
    let classes;
    if (teacher_id && typeof teacher_id === 'string') {
      classes = await this.service.getClassesByTeacher(teacher_id);
    } else if (active === 'true') {
      classes = await this.service.getActiveClasses();
    } else {
      classes = await this.service.getAllClasses();
    }
    res.json({ success: true, data: classes });
  });

  deactivate = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const cls = await this.service.deactivateClass(id);
    res.json({ success: true, data: cls });
  });

  activate = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const cls = await this.service.activateClass(id);
    res.json({ success: true, data: cls });
  });
}
