import { Router } from 'express';
import { weightController } from '../controllers/WeightController';

const router = Router();

router.get('/', weightController.getWeights);
router.put('/:id', weightController.updateWeight);
router.post('/review', weightController.markAsReviewed);

export default router;
