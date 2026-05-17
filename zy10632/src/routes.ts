import { Router } from 'express';
import * as priceListController from './controllers/priceListController';

const router = Router();

router.post('/price-lists', priceListController.createPriceList);
router.put('/price-lists/:id', priceListController.updatePriceList);
router.post('/price-lists/:id/submit', priceListController.submitForApproval);
router.post('/price-lists/:id/approve', priceListController.approvePriceList);
router.post('/price-lists/:id/rollback', priceListController.rollbackPriceList);
router.get('/price-lists', priceListController.getPriceListList);
router.get('/price-lists/:id', priceListController.getPriceListDetail);
router.get('/price-lists/export', priceListController.exportPriceLists);
router.get('/price-lists/:id/export', priceListController.exportPriceListDetail);
router.get('/stores', priceListController.getStores);

export default router;
