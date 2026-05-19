import { Router } from 'express';
import { TaskController } from './controllers/TaskController';
import { EnvironmentController } from './controllers/EnvironmentController';
import { DatasetController } from './controllers/DatasetController';
import { CleanupController } from './controllers/CleanupController';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/dashboard/stats', TaskController.getDashboardStats);
router.get('/dashboard/trend', TaskController.getTaskTrend);

router.post('/tasks', TaskController.createTask);
router.get('/tasks', TaskController.getTasks);
router.get('/tasks/:id', TaskController.getTaskById);
router.post('/tasks/:id/retry', TaskController.retryTask);
router.post('/tasks/:id/rollback', TaskController.rollbackTask);
router.get('/tasks/:id/export', TaskController.exportReport);

router.post('/rollbacks/:rollbackId/review', TaskController.reviewRollback);

router.post('/environments', EnvironmentController.createEnvironment);
router.get('/environments', EnvironmentController.getEnvironments);
router.get('/environments/:id', EnvironmentController.getEnvironmentById);
router.put('/environments/:id', EnvironmentController.updateEnvironment);
router.delete('/environments/:id', EnvironmentController.deleteEnvironment);

router.post('/datasets', DatasetController.createDataset);
router.get('/datasets', DatasetController.getDatasets);
router.get('/datasets/:id', DatasetController.getDatasetById);
router.put('/datasets/:id', DatasetController.updateDataset);
router.post('/datasets/:id/publish', DatasetController.publishDataset);
router.delete('/datasets/:id', DatasetController.deleteDataset);

router.post('/cleanup', CleanupController.createStrategy);
router.get('/cleanup', CleanupController.getStrategies);
router.get('/cleanup/:id', CleanupController.getStrategyById);
router.post('/cleanup/:id/execute', CleanupController.executeStrategy);
router.put('/cleanup/:id/correction', CleanupController.updateCorrectionPath);
router.post('/cleanup/:id/fail', CleanupController.markStrategyFailed);
router.delete('/cleanup/:id', CleanupController.deleteStrategy);

export default router;
