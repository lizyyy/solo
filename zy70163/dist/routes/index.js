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
const uuid_1 = require("uuid");
const lifecycleService = __importStar(require("../services/lifecycleService"));
const thawService = __importStar(require("../services/thawService"));
const loggingService = __importStar(require("../services/loggingService"));
const exportService = __importStar(require("../services/exportService"));
const types_1 = require("../models/types");
const router = (0, express_1.Router)();
router.get('/objects', async (req, res) => {
    try {
        const { bucketName, objectKey } = req.query;
        if (bucketName && objectKey) {
            const obj = await lifecycleService.getObjectByKey(bucketName, objectKey);
            if (obj) {
                res.json({ success: true, data: obj });
            }
            else {
                res.status(404).json({ success: false, error: 'Object not found' });
            }
        }
        else {
            res.status(400).json({ success: false, error: 'bucketName and objectKey are required' });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/objects/transition', async (req, res) => {
    try {
        const { objectId, targetClass } = req.body;
        const userId = req.headers['x-user-id'] || 'unknown';
        const requestId = (0, uuid_1.v4)();
        const result = await lifecycleService.transitionObjectToClass(objectId, targetClass, requestId, userId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/objects/delete', async (req, res) => {
    try {
        const { objectId } = req.body;
        const userId = req.headers['x-user-id'] || 'unknown';
        const requestId = (0, uuid_1.v4)();
        const result = await lifecycleService.deleteObject(objectId, requestId, userId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/thaw', async (req, res) => {
    try {
        const { objectId, thawDays, retrievalTier } = req.body;
        const userId = req.headers['x-user-id'] || 'unknown';
        const requestId = (0, uuid_1.v4)();
        const result = await thawService.createThawJob({
            objectId,
            requestedBy: userId,
            thawDays: thawDays || 7,
            retrievalTier: retrievalTier || 'standard',
            requestId,
            userId
        });
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/thaw/:thawJobId', async (req, res) => {
    try {
        const job = await thawService.getThawJobById(req.params.thawJobId);
        if (job) {
            res.json({ success: true, data: job });
        }
        else {
            res.status(404).json({ success: false, error: 'Thaw job not found' });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/thaw/:thawJobId/retry', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'unknown';
        const requestId = (0, uuid_1.v4)();
        const result = await thawService.retryThawJob(req.params.thawJobId, requestId, userId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/lifecycle/apply', async (req, res) => {
    try {
        const { bucketName } = req.body;
        const userId = req.headers['x-user-id'] || 'system';
        const requestId = (0, uuid_1.v4)();
        const results = await lifecycleService.applyLifecycleRules(bucketName, requestId, userId);
        res.json({
            success: true,
            data: results,
            summary: {
                total: results.length,
                success: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/admin/process-thaw-jobs', async (req, res) => {
    try {
        const results = await thawService.processPendingThawJobs();
        res.json({
            success: true,
            data: results
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/admin/advance-thaw/:thawJobId', async (req, res) => {
    try {
        const result = await thawService.advanceThawProgress(req.params.thawJobId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/admin/expire-thaws', async (req, res) => {
    try {
        const results = await thawService.expireThawJobs();
        res.json({
            success: true,
            data: results
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/logs', async (req, res) => {
    try {
        const { startTime, endTime, objectId } = req.query;
        if (objectId) {
            const logs = await loggingService.getLogsByObject(objectId);
            res.json({ success: true, data: logs });
        }
        else if (startTime && endTime) {
            const logs = await loggingService.getLogsByTimeRange(startTime, endTime);
            res.json({ success: true, data: logs });
        }
        else {
            const logs = await loggingService.getFailedOperations();
            res.json({ success: true, data: logs });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/export/operations', async (req, res) => {
    try {
        const { startTime, endTime } = req.body;
        const filepath = await exportService.exportOperationsReport(startTime, endTime);
        res.json({
            success: true,
            filepath,
            message: 'Operations report exported successfully'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/export/failed', async (req, res) => {
    try {
        const filepath = await exportService.exportFailedOperationsReport();
        res.json({
            success: true,
            filepath,
            message: 'Failed operations report exported successfully'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/test/setup', async (req, res) => {
    try {
        const now = new Date();
        const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
        await lifecycleService.createObject({
            objectId: 'obj-001',
            bucketName: 'test-bucket',
            objectKey: 'documents/report-2023.pdf',
            size: 5 * 1024 * 1024 * 1024,
            storageClass: types_1.StorageClass.ARCHIVE,
            lastModified: oldDate.toISOString(),
            createdTime: oldDate.toISOString(),
            eTag: 'etag-001',
            versionId: 'v1',
            deleteProtection: false,
            tags: {}
        });
        await lifecycleService.createObject({
            objectId: 'obj-002',
            bucketName: 'test-bucket',
            objectKey: 'images/photo-2024.jpg',
            size: 100 * 1024 * 1024,
            storageClass: types_1.StorageClass.STANDARD,
            lastModified: now.toISOString(),
            createdTime: now.toISOString(),
            eTag: 'etag-002',
            versionId: 'v1',
            deleteProtection: true,
            tags: {}
        });
        await lifecycleService.createObject({
            objectId: 'obj-003',
            bucketName: 'test-bucket',
            objectKey: 'backup/archive-2022.zip',
            size: 50 * 1024 * 1024 * 1024,
            storageClass: types_1.StorageClass.DEEP_ARCHIVE,
            lastModified: oldDate.toISOString(),
            createdTime: oldDate.toISOString(),
            eTag: 'etag-003',
            versionId: 'v1',
            deleteProtection: false,
            tags: {}
        });
        await lifecycleService.createLifecycleRule({
            ruleId: 'rule-001',
            bucketName: 'test-bucket',
            ruleName: 'archive-old-documents',
            status: 'enabled',
            prefix: 'documents/',
            actions: [
                {
                    action: types_1.LifecycleAction.TRANSITION,
                    daysAfterCreation: 30,
                    targetStorageClass: types_1.StorageClass.INFREQUENT_ACCESS
                },
                {
                    action: types_1.LifecycleAction.TRANSITION,
                    daysAfterCreation: 90,
                    targetStorageClass: types_1.StorageClass.ARCHIVE
                }
            ],
            priority: 10,
            createdTime: now.toISOString(),
            lastModified: now.toISOString()
        });
        res.json({ success: true, message: 'Test data setup completed' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
