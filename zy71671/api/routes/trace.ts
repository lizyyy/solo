import { Router } from 'express';
import TraceController from '../controllers/TraceController';

const router = Router({ mergeParams: true });

router.get('/', TraceController.traceField);
router.get('/breakdown', TraceController.getBreakdown);
router.get('/songs/:songId', TraceController.traceSongField);

export default router;
