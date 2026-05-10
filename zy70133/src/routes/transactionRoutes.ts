import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController';

const router = Router();

router.post('/deduct', TransactionController.deduct);
router.post('/refund', TransactionController.refund);
router.post('/compensate', TransactionController.compensate);
router.post('/revert', TransactionController.revert);
router.get('/:id', TransactionController.getTransaction);
router.get('/:id/history', TransactionController.getTransactionHistory);
router.get('/budget-pool/:budgetPoolId', TransactionController.getTransactionsByBudgetPool);
router.get('/campaign/:campaignId', TransactionController.getTransactionsByCampaign);

export default router;
