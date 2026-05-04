import { Request, Response } from 'express';
import { LessonService } from '../services';
import { wrapAsync } from '../middleware/error-handler';

export class LessonController {
  private readonly service: LessonService;

  constructor() {
    this.service = new LessonService();
  }

  create = wrapAsync(async (req: Request, res: Response) => {
    const { class_id, teacher_id, start_time, end_time, location, capacity, notes } = req.body;
    const lesson = await this.service.createLesson({
      class_id,
      teacher_id,
      start_time,
      end_time,
      location,
      capacity: capacity ? Number(capacity) : undefined,
      notes,
    });
    res.json({ success: true, data: lesson });
  });

  getById = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const lesson = await this.service.getLesson(id);
    res.json({ success: true, data: lesson });
  });

  getByTimeRange = wrapAsync(async (req: Request, res: Response) => {
    const { start_time, end_time } = req.query;
    if (!start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: '请提供 start_time 和 end_time 参数',
      });
    }
    const lessons = await this.service.getLessonsByTimeRange(
      start_time as string,
      end_time as string
    );
    res.json({ success: true, data: lessons });
  });

  book = wrapAsync(async (req: Request, res: Response) => {
    const { student_id, lesson_id, package_id } = req.body;
    const booking = await this.service.bookLesson(student_id, lesson_id, package_id);
    res.json({ success: true, data: booking });
  });

  joinWaitlist = wrapAsync(async (req: Request, res: Response) => {
    const { student_id, lesson_id } = req.body;
    const waitlist = await this.service.joinWaitlist(student_id, lesson_id);
    res.json({ success: true, data: waitlist });
  });

  cancelBooking = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const booking = await this.service.cancelBooking(id, reason);
    res.json({ success: true, data: booking });
  });

  requestLeave = wrapAsync(async (req: Request, res: Response) => {
    const { booking_id } = req.params;
    const { reason } = req.body;
    const result = await this.service.requestLeave(booking_id, reason);
    res.json({ success: true, data: result });
  });

  useMakeupTicket = wrapAsync(async (req: Request, res: Response) => {
    const { ticket_id, lesson_id } = req.body;
    const booking = await this.service.useMakeupTicket(ticket_id, lesson_id);
    res.json({ success: true, data: booking });
  });

  checkIn = wrapAsync(async (req: Request, res: Response) => {
    const { booking_id } = req.params;
    const booking = await this.service.checkIn(booking_id);
    res.json({ success: true, data: booking });
  });

  markAbsent = wrapAsync(async (req: Request, res: Response) => {
    const { booking_id } = req.params;
    const { reason } = req.body;
    const booking = await this.service.markAbsent(booking_id, reason);
    res.json({ success: true, data: booking });
  });

  convertWaitlist = wrapAsync(async (req: Request, res: Response) => {
    const { waitlist_id } = req.params;
    const { package_id } = req.body;
    const booking = await this.service.convertWaitlist(waitlist_id, package_id);
    res.json({ success: true, data: booking });
  });

  getMakeupTickets = wrapAsync(async (req: Request, res: Response) => {
    const { student_id } = req.params;
    const tickets = await this.service.getAvailableMakeupTickets(student_id);
    res.json({ success: true, data: tickets });
  });

  getWaitlist = wrapAsync(async (req: Request, res: Response) => {
    const { lesson_id } = req.params;
    const waitlist = await this.service.getWaitlistByLesson(lesson_id);
    res.json({ success: true, data: waitlist });
  });

  complete = wrapAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const lesson = await this.service.completeLesson(id);
    res.json({ success: true, data: lesson });
  });
}
