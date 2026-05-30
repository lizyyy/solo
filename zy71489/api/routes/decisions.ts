import { Router } from 'express';
import {
  getDecisions,
  getDecision,
  createDecision,
  toggleTrack,
  exportDecision,
} from '../controllers/DecisionController.js';

const router = Router();

router.get('/', getDecisions);
router.get('/:id', getDecision);
router.post('/', createDecision);
router.post('/:id/toggle-track', toggleTrack);
router.get('/:id/export', exportDecision);

export default router;
