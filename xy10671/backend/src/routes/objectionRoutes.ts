import { Router } from 'express';
import * as objectionController from '../controllers/objectionController';

const router = Router();

router.get('/:projectId', objectionController.getObjections);
router.post('/:projectId', objectionController.createObjection);
router.post('/:id/resolve', objectionController.resolveObjection);

export default router;
