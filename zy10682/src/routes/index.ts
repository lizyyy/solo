import { Router } from 'express';
import { compensationController } from '../controllers/compensationController';

const router = Router();

router.post('/compensations', compensationController.create.bind(compensationController));
router.put('/compensations/:id', compensationController.update.bind(compensationController));
router.post('/compensations/:id/approve', compensationController.approve.bind(compensationController));
router.post('/compensations/:id/withdraw', compensationController.withdraw.bind(compensationController));
router.get('/compensations/:id', compensationController.get.bind(compensationController));
router.get('/compensations', compensationController.list.bind(compensationController));
router.get('/compensations/:id/history', compensationController.getHistory.bind(compensationController));
router.get('/compensations/export', compensationController.export.bind(compensationController));
router.post('/compensations/:id/consume', compensationController.markConsumed.bind(compensationController));

export default router;
