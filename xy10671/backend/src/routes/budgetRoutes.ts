import { Router } from 'express';
import * as budgetController from '../controllers/budgetController';

const router = Router();

router.get('/:projectId', budgetController.getQuotes);
router.get('/:projectId/summary', budgetController.getBudgetSummary);
router.post('/:projectId', budgetController.createQuote);
router.put('/:id', budgetController.updateQuote);
router.post('/:id/approve', budgetController.approveQuote);

export default router;
