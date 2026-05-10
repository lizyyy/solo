import { Router } from 'express';
import { getPlans, getPlan, createPlan, updatePlan, getPlanHistory } from '../controllers/planController';

const router = Router();

router.get('/', getPlans);
router.get('/history', getPlanHistory);
router.get('/:id', getPlan);
router.post('/', createPlan);
router.put('/:id', updatePlan);

export default router;
