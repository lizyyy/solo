import { Router } from 'express';
import * as configItemController from './controllers/configItem.controller';
import * as distributionController from './controllers/distribution.controller';
import * as pullRecordController from './controllers/pullRecord.controller';
import * as serviceInstanceController from './controllers/serviceInstance.controller';
import * as diffReportController from './controllers/diffReport.controller';
import * as overviewController from './controllers/overview.controller';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/overview/statistics', overviewController.getStatistics);
router.get('/overview/activity', overviewController.getRecentActivity);
router.get('/overview/failed', overviewController.getFailedDetails);

router.post('/configs', configItemController.createConfigItem);
router.get('/configs', configItemController.getConfigItems);
router.get('/configs/:id', configItemController.getConfigItem);
router.put('/configs/:id', configItemController.updateConfigItem);
router.delete('/configs/:id', configItemController.deleteConfigItem);

router.post('/distributions/publish', distributionController.publishVersion);
router.get('/distributions/config/:configId', distributionController.getVersions);
router.get('/distributions/:id', distributionController.getVersionDetail);
router.post('/distributions/refresh/:configId', distributionController.forceRefresh);

router.post('/pulls/report', pullRecordController.reportPullResult);
router.get('/pulls', pullRecordController.getPullRecords);
router.get('/pulls/failed', pullRecordController.getFailedRecords);
router.post('/pulls/:id/retry', pullRecordController.retryFailed);
router.get('/pulls/old-values/:configId', pullRecordController.detectOldValues);

router.post('/instances', serviceInstanceController.createServiceInstance);
router.get('/instances', serviceInstanceController.getServiceInstances);
router.get('/instances/:id', serviceInstanceController.getServiceInstance);
router.post('/instances/heartbeat', serviceInstanceController.heartbeat);
router.put('/instances/:id/status', serviceInstanceController.updateInstanceStatus);
router.delete('/instances/:id', serviceInstanceController.deleteServiceInstance);

router.post('/diff-reports', diffReportController.generateDiffReport);
router.get('/diff-reports', diffReportController.getDiffReports);
router.get('/diff-reports/:id', diffReportController.getDiffReport);
router.get('/diff-reports/:id/export', diffReportController.exportReportToCSV);
router.get('/effective-states/:configId/export', diffReportController.exportEffectiveStatesToCSV);

export default router;
