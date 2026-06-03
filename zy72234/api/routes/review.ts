import { Router } from 'express';
import { ReviewController } from '../controllers/ReviewController.js';

const router = Router();

router.get('/', ReviewController.getAll);
router.get('/pending', ReviewController.getPendingReviews);
router.get('/flagged', ReviewController.getFlagged);
router.get('/:id', ReviewController.getById);
router.post('/:id/review', ReviewController.review);

export default router;
