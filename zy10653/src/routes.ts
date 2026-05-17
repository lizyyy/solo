import { Router } from 'express';
import { TranscodeTaskController } from './controllers/TranscodeTaskController';

const router = Router();
const controller = new TranscodeTaskController();

router.post('/tasks', controller.createTask);
router.get('/tasks', controller.queryTasks);
router.get('/tasks/:id', controller.getTask);
router.post('/tasks/:id/status', controller.updateTaskStatus);
router.get('/tasks/:id/history', controller.getTaskHistory);
router.get('/tasks/:id/validations', controller.getRowValidations);
router.get('/tasks/:id/bad-rows', controller.getBadRows);
router.post('/tasks/:id/check-file-changed', controller.checkSourceFileChanged);

router.post('/retry/manual', controller.manualRetry);
router.post('/retry/batch', controller.batchRetry);
router.post('/conflict/resolve', controller.resolveConflict);

router.get('/export/tasks', controller.exportTasks);

export default router;
