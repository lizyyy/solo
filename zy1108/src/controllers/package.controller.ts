import { Request, Response } from 'express';
import { PackageService } from '../services';
import { wrapAsync } from '../middleware/error-handler';

export class PackageController {
  private readonly service: PackageService;

  constructor() {
    this.service = new PackageService();
  }

  createTemplate = wrapAsync(async (req: Request, res: Response) => {
    const { name, total_lessons, price, valid_days, description } = req.body;
    const template = await this.service.createTemplate({
      name,
      total_lessons: Number(total_lessons),
      price: price ? Number(price) : undefined,
      valid_days: valid_days ? Number(valid_days) : undefined,
      description,
    });
    res.json({ success: true, data: template });
  });

  createStudentPackage = wrapAsync(async (req: Request, res: Response) => {
    const { student_id, template_id, name, total_lessons, valid_days, valid_from, notes } = req.body;
    const pkg = await this.service.createStudentPackage({
      student_id,
      template_id,
      name,
      total_lessons: Number(total_lessons),
      valid_days: valid_days ? Number(valid_days) : undefined,
      valid_from,
      notes,
    });
    res.json({ success: true, data: pkg });
  });

  getById = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const pkg = await this.service.getStudentPackage(id);
    res.json({ success: true, data: pkg });
  });

  getByStudent = wrapAsync(async (req: Request, res: Response) => {
    const { studentId } = req.params;
    const packages = await this.service.getStudentPackages(studentId);
    res.json({ success: true, data: packages });
  });

  getActiveByStudent = wrapAsync(async (req: Request, res: Response) => {
    const { studentId } = req.params;
    const packages = await this.service.getActiveStudentPackages(studentId);
    res.json({ success: true, data: packages });
  });

  freeze = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { freeze_days } = req.body;
    const pkg = await this.service.freezePackage(id, Number(freeze_days));
    res.json({ success: true, data: pkg });
  });

  unfreeze = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const pkg = await this.service.unfreezePackage(id);
    res.json({ success: true, data: pkg });
  });

  deduct = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { booking_id } = req.body;
    const pkg = await this.service.deductLesson(id, booking_id);
    res.json({ success: true, data: pkg });
  });

  refund = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { booking_id } = req.body;
    const pkg = await this.service.refundLesson(id, booking_id);
    res.json({ success: true, data: pkg });
  });

  adjust = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { adjust_amount, reason } = req.body;
    const pkg = await this.service.adjustBalance(id, Number(adjust_amount), reason);
    res.json({ success: true, data: pkg });
  });

  recalculate = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const pkg = await this.service.recalculatePackageBalance(id);
    res.json({ success: true, data: pkg });
  });

  getBalance = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const balance = await this.service.getPackageBalance(id);
    res.json({ success: true, data: balance });
  });
}
