import { Router } from 'express';
import {
  executeAudit,
  getBatch,
  listBatches,
  getAnomalies,
  exportAnomalies,
  exportReport,
  downloadExport,
} from '../controllers/auditController';

const router = Router();

router.post('/audit/execute', executeAudit);
router.get('/audit/batches', listBatches);
router.get('/audit/batches/:batchId', getBatch);
router.get('/audit/batches/:batchId/anomalies', getAnomalies);
router.post('/audit/batches/:batchId/export-anomalies', exportAnomalies);
router.post('/audit/batches/:batchId/export-report', exportReport);
router.get('/export/download', downloadExport);

export default router;
