import { Router } from 'express';
import { getSessions, createSession, completeSession } from '../controllers/sessionController';

const router = Router();

router.get('/', getSessions);
router.post('/', createSession);
router.post('/:id/complete', completeSession);

export default router;
