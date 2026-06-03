import { Router } from 'express';
import { CustodyController } from '../controllers/CustodyController.js';

const router = Router();

router.get('/', CustodyController.getAll);
router.get('/:id', CustodyController.getById);
router.get('/adjustment/:adjustmentId', CustodyController.getByAdjustmentId);
router.get('/adjustment/:adjustmentId/full', CustodyController.getAdjustmentWithCustody);
router.get('/adjustment/:adjustmentId/jump-target', CustodyController.getJumpTarget);
router.post('/', CustodyController.create);
router.put('/:id', CustodyController.update);

export default router;
