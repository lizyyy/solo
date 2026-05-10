import { Router } from 'express';
import { BudgetPoolController } from '../controllers/BudgetPoolController';

const router = Router();

router.post('/', BudgetPoolController.createBudgetPool);
router.get('/', BudgetPoolController.getAllBudgetPools);
router.get('/:id', BudgetPoolController.getBudgetPool);
router.get('/:id/available', BudgetPoolController.getAvailableAmount);
router.put('/:id/status', BudgetPoolController.updateStatus);
router.post('/:id/add-budget', BudgetPoolController.addBudget);

export default router;
