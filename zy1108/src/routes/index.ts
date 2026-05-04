import { Router } from 'express';
import { TeacherController } from '../controllers/teacher.controller';
import { StudentController } from '../controllers/student.controller';
import { ClassController } from '../controllers/class.controller';
import { PackageController } from '../controllers/package.controller';
import { LessonController } from '../controllers/lesson.controller';
import { NotificationController } from '../controllers/notification.controller';
import { ExportController } from '../controllers/export.controller';

const router = Router();

const teacherController = new TeacherController();
const studentController = new StudentController();
const classController = new ClassController();
const packageController = new PackageController();
const lessonController = new LessonController();
const notificationController = new NotificationController();
const exportController = new ExportController();

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Dance Studio API is running' });
});

// Teachers routes
router.post('/teachers', teacherController.create);
router.get('/teachers', teacherController.getAll);
router.get('/teachers/:id', teacherController.getById);
router.put('/teachers/:id', teacherController.update);
router.post('/teachers/:id/deactivate', teacherController.deactivate);
router.post('/teachers/:id/activate', teacherController.activate);

// Students routes
router.post('/students', studentController.create);
router.get('/students', studentController.getAll);
router.get('/students/:id', studentController.getById);
router.get('/students/:id/balances', studentController.getBalances);
router.put('/students/:id', studentController.update);
router.post('/students/:id/deactivate', studentController.deactivate);
router.post('/students/:id/activate', studentController.activate);

// Classes routes
router.post('/classes', classController.create);
router.get('/classes', classController.getAll);
router.get('/classes/:id', classController.getById);
router.put('/classes/:id', classController.update);
router.post('/classes/:id/deactivate', classController.deactivate);
router.post('/classes/:id/activate', classController.activate);

// Package templates routes
router.post('/packages/templates', packageController.createTemplate);

// Student packages routes
router.post('/packages', packageController.createStudentPackage);
router.get('/packages/student/:studentId', packageController.getByStudent);
router.get('/packages/student/:studentId/active', packageController.getActiveByStudent);
router.get('/packages/:id', packageController.getById);
router.get('/packages/:id/balance', packageController.getBalance);
router.post('/packages/:id/freeze', packageController.freeze);
router.post('/packages/:id/unfreeze', packageController.unfreeze);
router.post('/packages/:id/deduct', packageController.deduct);
router.post('/packages/:id/refund', packageController.refund);
router.post('/packages/:id/adjust', packageController.adjust);
router.post('/packages/:id/recalculate', packageController.recalculate);

// Lessons routes
router.post('/lessons', lessonController.create);
router.get('/lessons', lessonController.getByTimeRange);
router.get('/lessons/:id', lessonController.getById);
router.post('/lessons/:id/complete', lessonController.complete);
router.get('/lessons/:lesson_id/waitlist', lessonController.getWaitlist);

// Booking routes
router.post('/bookings', lessonController.book);
router.post('/bookings/:id/cancel', lessonController.cancelBooking);
router.post('/bookings/:booking_id/checkin', lessonController.checkIn);
router.post('/bookings/:booking_id/absent', lessonController.markAbsent);

// Leave routes
router.post('/leaves/:booking_id', lessonController.requestLeave);

// Makeup ticket routes
router.post('/makeup-tickets/use', lessonController.useMakeupTicket);
router.get('/makeup-tickets/student/:student_id', lessonController.getMakeupTickets);

// Waitlist routes
router.post('/waitlists', lessonController.joinWaitlist);
router.post('/waitlists/:waitlist_id/convert', lessonController.convertWaitlist);

// Notification routes
router.get('/notifications', notificationController.getAll);
router.get('/notifications/unread', notificationController.getUnread);
router.post('/notifications/:id/read', notificationController.markAsRead);
router.post('/notifications/read-all', notificationController.markAllAsRead);
router.get('/todos', notificationController.getToDos);

// Export routes
router.get('/export/student-balances', exportController.getStudentBalances);
router.get('/export/teacher-payments', exportController.getTeacherPayments);
router.get('/export/monthly/:year/:month', exportController.getMonthlyReport);

export default router;
