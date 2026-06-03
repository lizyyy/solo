import { Router } from 'express';
import AdjustmentController from '../controllers/AdjustmentController';

const router = Router();

router.get('/', AdjustmentController.getAllAdjustments);
router.get('/record/:recordId', AdjustmentController.getAdjustmentsByRecordId);
router.post('/', AdjustmentController.createAdjustment);
router.get('/:id/impact', AdjustmentController.getAdjustmentImpact);
router.post('/recalculate', AdjustmentController.recalculateAll);

export default router;
