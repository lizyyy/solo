import { Router } from 'express';
import ValidationController from '../controllers/ValidationController';

const router = Router({ mergeParams: true });

router.post('/', ValidationController.validate);

export default router;
