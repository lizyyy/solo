import { Router } from 'express';
import * as reconciliationController from '../controllers/reconciliationController';

const router = Router();

router.post('/order/:orderNo', reconciliationController.reconcileOrder);
router.post('/all', reconciliationController.reconcileAllOrders);
router.get('/order/:orderNo', reconciliationController.getReconciliationResult);
router.get('/all', reconciliationController.getAllReconciliationResults);
router.get('/discrepancy-explanation/:type', reconciliationController.getDiscrepancyExplanation);

export default router;
