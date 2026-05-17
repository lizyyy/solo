import { Router } from 'express';
import * as operationController from '../controllers/operationController';

const router = Router();

router.post('/', operationController.createOperation);
router.get('/query', operationController.queryOperations);
router.get('/no/:operationNo', operationController.getOperationByNo);
router.get('/statistics', operationController.getStatistics);
router.get('/statistics/report', operationController.getStatisticsReport);
router.get('/export/csv', operationController.exportCSV);
router.get('/export/json', operationController.exportJSON);
router.get('/:id', operationController.getOperation);
router.post('/:id/confirm', operationController.confirmOperation);
router.post('/:id/lock', operationController.lockOperation);
router.post('/:id/start', operationController.startExecution);
router.post('/:id/complete', operationController.completeOperation);
router.post('/:id/fail', operationController.failOperation);
router.post('/:id/abort', operationController.abortOperation);
router.post('/:id/mark-correction', operationController.markForManualCorrection);
router.post('/:id/correct', operationController.manualCorrection);

export default router;
