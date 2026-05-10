import { Router } from 'express';
import { exportMemberPlan } from '../controllers/exportController';

const router = Router();

router.get('/plan', exportMemberPlan);

export default router;
