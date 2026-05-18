import { Router } from 'express';
import { quoteController } from '../controllers/quoteController';

const router = Router();

router.get('/', quoteController.getAllQuotes);
router.get('/:id', quoteController.getQuoteById);
router.get('/number/:number', quoteController.getQuoteByNumber);
router.post('/', quoteController.createQuote);
router.post('/:id/submit', quoteController.submitForApproval);
router.post('/:id/accept', quoteController.customerAcceptQuote);
router.post('/:id/add-hidden-fault', quoteController.addHiddenFault);
router.post('/:id/review-supplement/:recordId', quoteController.reviewSupplement);
router.post('/:id/complete', quoteController.completeQuote);
router.get('/:id/change-records', quoteController.getChangeRecords);

export default router;
