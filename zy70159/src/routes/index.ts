import { Router } from 'express';
import ExportController from '../controllers/ExportController';

const router = Router();

router.post('/export/request', ExportController.createExportRequest);
router.get('/export/request/:id', ExportController.getRequest);
router.post('/export/approve', ExportController.approveRequest);
router.post('/export/reject', ExportController.rejectRequest);
router.post('/export/process', ExportController.processApprovedRequest);
router.post('/export/download/:id', ExportController.downloadFile);
router.get('/export/report/:id', ExportController.getTaskReport);

router.get('/sensitive-fields', ExportController.getSensitiveFields);
router.post('/sensitive-fields', ExportController.createSensitiveField);

router.get('/exceptions/pending', ExportController.getPendingExceptions);
router.get('/exceptions', ExportController.getAllExceptions);
router.post('/exceptions/:id/process', ExportController.processException);

export default router;
