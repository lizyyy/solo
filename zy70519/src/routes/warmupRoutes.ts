import { Router } from 'express';
import { WarmupController, NodeController, DataSourceController } from '../controllers/warmupController';

const router = Router();

router.post('/batches', WarmupController.createBatch);
router.get('/batches', WarmupController.listBatches);
router.get('/batches/:batchId', WarmupController.getBatch);
router.post('/batches/:batchId/start', WarmupController.startBatch);
router.patch('/batches/:batchId/status', WarmupController.updateBatchStatus);
router.get('/batches/:batchId/failed', WarmupController.getFailedKeys);
router.get('/batches/:batchId/report', WarmupController.getReport);
router.get('/batches/:batchId/export', WarmupController.exportBatch);

router.post('/keys/status', WarmupController.updateKeyStatus);
router.get('/keys/:cacheKeyId/retry-records', WarmupController.getRetryRecords);

router.post('/manual-fix', WarmupController.manualFix);

router.post('/nodes', NodeController.registerNode);
router.get('/nodes', NodeController.listNodes);
router.post('/nodes/:nodeId/heartbeat', NodeController.heartbeat);
router.patch('/nodes/:nodeId/status', NodeController.updateStatus);

router.post('/data-sources', DataSourceController.createDataSource);
router.get('/data-sources', DataSourceController.listDataSources);

export default router;
