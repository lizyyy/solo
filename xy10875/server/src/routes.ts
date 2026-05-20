import { Router } from 'express';
import * as invoiceController from './controllers/invoiceController';

const router = Router();

router.get('/invoices', invoiceController.getInvoices);
router.get('/invoices/:id', invoiceController.getInvoiceDetail);
router.post('/invoices', invoiceController.createInvoice);
router.post('/invoices/batch', invoiceController.batchImportInvoices);
router.post('/invoices/:id/match', invoiceController.manualMatch);
router.post('/matches/:id/confirm', invoiceController.confirmMatch);
router.post('/duplicates/:id/resolve', invoiceController.resolveDuplicate);

router.get('/trips', invoiceController.getTrips);
router.get('/budgets', invoiceController.getBudgets);

router.get('/statistics', invoiceController.getStatistics);
router.post('/reports', invoiceController.generateReport);
router.get('/reports/:fileName', invoiceController.downloadReport);

export default router;
