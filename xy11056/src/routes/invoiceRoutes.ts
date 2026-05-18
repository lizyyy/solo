import { Router } from 'express';
import { invoiceController } from '../controllers/invoiceController';

const router = Router();

router.get('/', invoiceController.getAll.bind(invoiceController));
router.get('/:id', invoiceController.getById.bind(invoiceController));
router.post('/', invoiceController.create.bind(invoiceController));
router.put('/:id', invoiceController.update.bind(invoiceController));
router.delete('/:id', invoiceController.delete.bind(invoiceController));
router.get('/export/csv', invoiceController.exportCSV.bind(invoiceController));
router.post('/import', invoiceController.importCSV.bind(invoiceController));
router.post('/validate-summary', invoiceController.validateSummary.bind(invoiceController));

export default router;
