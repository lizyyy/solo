import { Router } from 'express';
import { WeightController } from '../controllers/weight.controller';

const router = Router();
const weightController = new WeightController();

router.post('/', weightController.submitWeight);
router.post('/replace', weightController.replaceItemWithWeight);
router.get('/:id', weightController.getWeightRecord);
router.get('/order/:orderId', weightController.getWeightRecordsByOrder);
router.get('/history/:orderItemId', weightController.getWeightHistory);

export default router;
