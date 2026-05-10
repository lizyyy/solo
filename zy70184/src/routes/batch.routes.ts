import { Router } from 'express';
import { batchController } from '../controllers/batch.controller';

const router = Router();

router.post('/', batchController.validate.create, batchController.createBatch);
router.post('/validate', batchController.validate.validateOnly, batchController.validateBatch);
router.get('/', batchController.validate.list, batchController.listBatches);
router.get('/:id', batchController.validate.get, batchController.getBatch);
router.post('/:id/submit', batchController.validate.submit, batchController.submitBatch);
router.post('/:id/cancel', batchController.validate.cancel, batchController.cancelBatch);

export default router;
