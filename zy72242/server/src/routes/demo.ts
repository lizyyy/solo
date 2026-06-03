import { Router } from 'express';
import DemoController from '../controllers/DemoController';

const router = Router();

router.get('/init', DemoController.initDemo);
router.get('/guide', DemoController.getDemoGuide);
router.post('/reset', DemoController.resetDemo);
router.get('/holidays', DemoController.getHolidays);
router.get('/calculate-expected-date', DemoController.calculateExpectedDate);

export default router;
