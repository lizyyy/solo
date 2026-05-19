"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const configItemController = __importStar(require("./controllers/configItem.controller"));
const distributionController = __importStar(require("./controllers/distribution.controller"));
const pullRecordController = __importStar(require("./controllers/pullRecord.controller"));
const serviceInstanceController = __importStar(require("./controllers/serviceInstance.controller"));
const diffReportController = __importStar(require("./controllers/diffReport.controller"));
const overviewController = __importStar(require("./controllers/overview.controller"));
const router = (0, express_1.Router)();
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
router.get('/distributions', distributionController.getAllVersions);
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
router.get('/diff-reports/config-versions/:key', diffReportController.getConfigVersions);
router.get('/diff-reports/:id', diffReportController.getDiffReport);
router.get('/diff-reports/:id/export', diffReportController.exportReportToCSV);
router.get('/effective-states/:configId/export', diffReportController.exportEffectiveStatesToCSV);
exports.default = router;
