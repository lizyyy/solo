import { Router } from 'express';
import * as riskController from '../controllers/riskController';
import * as promoCodeController from '../controllers/promoCodeController';

const router = Router();

router.post('/risk/check', riskController.checkPromoCodeRisk);
router.get('/risk/block-events', riskController.getBlockEvents);
router.get('/risk/block-events/export', riskController.exportBlockEvents);
router.get('/risk/block-events/:id', riskController.getBlockEventDetail);
router.post('/risk/block-events/:id/allow', riskController.manualAllow);
router.post('/risk/block-events/:id/compensate', riskController.compensate);
router.get('/risk/allow-records', riskController.getAllowRecords);
router.get('/risk/dashboard', riskController.getDashboardStats);

router.post('/promo-codes', promoCodeController.createPromoCode);
router.get('/promo-codes', promoCodeController.getPromoCodes);
router.get('/promo-codes/:id', promoCodeController.getPromoCodeDetail);
router.put('/promo-codes/:id/status', promoCodeController.updatePromoCodeStatus);

export default router;
