import { Router } from 'express';
import { ArrangementController } from '../controllers/ArrangementController';

const router = Router();
const controller = new ArrangementController();

router.get('/', controller.getAll);
router.get('/latest', controller.getLatest);
router.get('/:id', controller.getById);
router.get('/:id/assignments', controller.getAssignments);
router.get('/:id/conflicts', controller.detectConflicts);
router.get('/:id/swap-logs', controller.getSwapLogs);
router.post('/', controller.create);
router.post('/:id/version', controller.createVersion);
router.put('/:id', controller.update);
router.put('/:id/assign', controller.assign);
router.delete('/:id/assign/:stallId', controller.removeAssignment);
router.post('/:id/swap', controller.swap);

export default router;
