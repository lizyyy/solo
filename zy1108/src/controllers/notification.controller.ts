import { Request, Response } from 'express';
import { NotificationService } from '../services';
import { wrapAsync } from '../middleware/error-handler';

export class NotificationController {
  private readonly service: NotificationService;

  constructor() {
    this.service = new NotificationService();
  }

  getUnread = wrapAsync(async (req: Request, res: Response) => {
    const notifications = await this.service.getUnreadNotifications();
    res.json({ success: true, data: notifications });
  });

  getAll = wrapAsync(async (req: Request, res: Response) => {
    const notifications = await this.service.getAllNotifications();
    res.json({ success: true, data: notifications });
  });

  markAsRead = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const notification = await this.service.markAsRead(id);
    res.json({ success: true, data: notification });
  });

  markAllAsRead = wrapAsync(async (req: Request, res: Response) => {
    const count = await this.service.markAllAsRead();
    res.json({ success: true, data: { marked_count: count } });
  });

  getToDos = wrapAsync(async (req: Request, res: Response) => {
    const todos = await this.service.generateToDos();
    res.json({ success: true, data: todos });
  });
}
