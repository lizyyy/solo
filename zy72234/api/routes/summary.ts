import { Router } from 'express';
import { SummaryController } from '../controllers/SummaryController.js';

const router = Router();

router.get('/', SummaryController.getAll);
router.get('/flagged', SummaryController.getFlagged);
router.get('/:id', SummaryController.getById);

export default router;
