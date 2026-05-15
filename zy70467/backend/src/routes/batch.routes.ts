import { Router } from 'express';
import * as batchController from '../controllers/batch.controller';

const router = Router();

router.post('/', batchController.createBatch);
router.get('/', batchController.getBatchList);
router.get('/:id', batchController.getBatchDetail);
router.post('/:id/execute', batchController.executeBatch);
router.get('/:id/report', batchController.getBatchReport);
router.get('/:id/failed-items/export', batchController.exportFailedItems);

export default router;
