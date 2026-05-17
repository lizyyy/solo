import { Router } from 'express';
import { correctionController } from '../controllers/CorrectionController';

const router = Router();

router.post('/', correctionController.createCorrection.bind(correctionController));
router.get('/', correctionController.listCorrections.bind(correctionController));
router.get('/:id', correctionController.getCorrection.bind(correctionController));

router.post('/:id/preview', correctionController.generatePreview.bind(correctionController));
router.post('/:id/submit', correctionController.submitForApproval.bind(correctionController));
router.post('/:id/approve', correctionController.approveCorrection.bind(correctionController));
router.post('/:id/reject', correctionController.rejectCorrection.bind(correctionController));
router.post('/:id/execute', correctionController.executeCorrection.bind(correctionController));
router.post('/:id/rollback', correctionController.rollbackCorrection.bind(correctionController));

router.post('/:id/assets/:assetId/manual-fix', correctionController.manualFix.bind(correctionController));
router.post('/exceptions/:exceptionId/resolve', correctionController.resolveException.bind(correctionController));

router.post('/:id/report', correctionController.generateReport.bind(correctionController));
router.get('/reports/:reportId', correctionController.getReport.bind(correctionController));
router.get('/reports/:reportId/export', correctionController.exportReport.bind(correctionController));

export default router;
