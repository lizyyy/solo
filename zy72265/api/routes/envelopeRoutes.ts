import { Router } from 'express';
import { envelopeController } from '../controllers/envelopeController';

const router = Router();

router.get('/api/envelopes', envelopeController.getEnvelopes);
router.get('/api/envelopes/:id', envelopeController.getEnvelopeById);
router.post('/api/envelopes/import', envelopeController.importLog);
router.put('/api/envelopes/:id/step', envelopeController.advanceWorkflow);
router.get('/api/envelopes/:id/export', envelopeController.exportEnvelope);
router.get('/api/envelopes/:id/audit', envelopeController.getAuditLogs);

router.put('/api/points/:id/confirm', envelopeController.confirmNormalPoint);
router.post('/api/points/:id/review', envelopeController.reviewPoint);

router.get('/api/rules', envelopeController.getBoundaryRules);
router.put('/api/rules/:id', envelopeController.updateBoundaryRule);

router.get('/api/safety-radius', envelopeController.getSafetyRadiusTable);

export default router;
