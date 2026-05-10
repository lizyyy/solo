import { Router } from 'express';
import { limitController } from '../controllers/limit.controller';

const router = Router();

router.post('/', limitController.validate.create, limitController.createLimit);
router.get('/', limitController.validate.list, limitController.listLimits);
router.get('/check', limitController.validate.check, limitController.checkLimit);

export default router;
