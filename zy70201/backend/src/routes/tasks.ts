import { Router } from 'express';
import { taskController } from '../controllers/taskController';

const router = Router();

router.get('/', taskController.getAllTasks);
router.get('/export', taskController.exportTasks);
router.post('/', taskController.createTask);
router.post('/assign', taskController.assignTask);
router.post('/auto-schedule', taskController.autoSchedule);
router.get('/:id', taskController.getTaskById);
router.post('/:id/confirm', taskController.confirmTask);
router.post('/:id/reject', taskController.rejectTask);
router.post('/:id/complete', taskController.completeTask);
router.post('/:id/cancel', taskController.cancelTask);

export default router;
