import { Router } from 'express';
import { selfCheckController } from '../controllers/SelfCheckController';

const router = Router();

router.get('/', selfCheckController.runSelfCheck);

export default router;
