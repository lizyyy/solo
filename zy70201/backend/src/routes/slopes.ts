import { Router } from 'express';
import { slopeController } from '../controllers/slopeController';

const router = Router();

router.get('/', slopeController.getAllSlopes);
router.get('/needing-grooming', slopeController.getSlopesNeedingGrooming);
router.get('/:id', slopeController.getSlopeById);
router.post('/', slopeController.createSlope);
router.put('/:id', slopeController.updateSlope);
router.delete('/:id', slopeController.deleteSlope);

export default router;
