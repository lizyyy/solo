import { Router } from 'express';
import { recorderController, exportController, auditController, sessionController } from '../controllers';
import { errorHandler } from '../middleware/errorHandler';

const router = Router();

function wrapAsync(fn: (req: any, res: any, next: any) => Promise<void>) {
  return (req: any, res: any, next: any) => {
    fn(req, res, next).catch(next);
  };
}

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.post('/api/v1/recorder/submit', wrapAsync(recorderController.submitRecord.bind(recorderController)));
router.post('/api/v1/recorder/batch', wrapAsync(recorderController.submitBatch.bind(recorderController)));
router.post('/api/v1/recorder/playback', wrapAsync(recorderController.playback.bind(recorderController)));
router.get('/api/v1/recorder/failed', wrapAsync(recorderController.getAllFailedRecords.bind(recorderController)));
router.get('/api/v1/recorder/failed/:failureType', wrapAsync(recorderController.queryByFailureType.bind(recorderController)));

router.post('/api/v1/export/failed', wrapAsync(exportController.exportFailedRecords.bind(exportController)));
router.get('/api/v1/export/files', wrapAsync(exportController.getExportFiles.bind(exportController)));

router.get('/api/v1/audit', wrapAsync(auditController.getAllAudit.bind(auditController)));
router.get('/api/v1/audit/pending', wrapAsync(auditController.getPendingConfirmations.bind(auditController)));
router.post('/api/v1/audit/:id/confirm', wrapAsync(auditController.confirmAuditEntry.bind(auditController)));

router.post('/api/v1/sessions', wrapAsync(sessionController.createSession.bind(sessionController)));
router.get('/api/v1/sessions', wrapAsync(sessionController.getAllSessions.bind(sessionController)));
router.get('/api/v1/sessions/:id', wrapAsync(sessionController.getSession.bind(sessionController)));

router.use(errorHandler);

export default router;
