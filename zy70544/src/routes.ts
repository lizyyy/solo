import { Router } from 'express';
import { RecalculationController } from './controllers/recalculationController';
import { DatabaseService } from './services/databaseService';

export const createRouter = (dbService: DatabaseService): Router => {
  const router = Router();
  const controller = new RecalculationController(dbService);

  router.post('/applications', controller.createApplication);
  router.get('/applications', controller.getApplications);
  router.get('/applications/:id', controller.getApplicationById);
  router.put('/applications/:id/status', controller.updateStatus);
  router.get('/applications/:id/approval-history', controller.getApprovalHistory);
  router.get('/applications/:id/snapshots', controller.getSnapshots);
  router.post('/applications/:id/fail', controller.markAsFailed);
  router.post('/applications/:id/manual-correction', controller.applyManualCorrection);
  router.post('/applications/:id/complete', controller.completeApplication);
  router.get('/export', controller.exportApplications);

  return router;
};