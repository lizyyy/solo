import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as lifecycleService from '../services/lifecycleService';
import * as thawService from '../services/thawService';
import * as loggingService from '../services/loggingService';
import * as exportService from '../services/exportService';
import { StorageClass, LifecycleAction } from '../models/types';

const router = Router();

router.get('/objects', async (req: Request, res: Response) => {
  try {
    const { bucketName, objectKey } = req.query;
    if (bucketName && objectKey) {
      const obj = await lifecycleService.getObjectByKey(
        bucketName as string,
        objectKey as string
      );
      if (obj) {
        res.json({ success: true, data: obj });
      } else {
        res.status(404).json({ success: false, error: 'Object not found' });
      }
    } else {
      res.status(400).json({ success: false, error: 'bucketName and objectKey are required' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/objects/transition', async (req: Request, res: Response) => {
  try {
    const { objectId, targetClass } = req.body;
    const userId = (req.headers['x-user-id'] as string) || 'unknown';
    const requestId = uuidv4();
    
    const result = await lifecycleService.transitionObjectToClass(
      objectId,
      targetClass,
      requestId,
      userId
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/objects/delete', async (req: Request, res: Response) => {
  try {
    const { objectId } = req.body;
    const userId = (req.headers['x-user-id'] as string) || 'unknown';
    const requestId = uuidv4();
    
    const result = await lifecycleService.deleteObject(
      objectId,
      requestId,
      userId
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/thaw', async (req: Request, res: Response) => {
  try {
    const { objectId, thawDays, retrievalTier } = req.body;
    const userId = (req.headers['x-user-id'] as string) || 'unknown';
    const requestId = uuidv4();
    
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
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/thaw/:thawJobId', async (req: Request, res: Response) => {
  try {
    const job = await thawService.getThawJobById(req.params.thawJobId);
    if (job) {
      res.json({ success: true, data: job });
    } else {
      res.status(404).json({ success: false, error: 'Thaw job not found' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/thaw/:thawJobId/retry', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'unknown';
    const requestId = uuidv4();
    
    const result = await thawService.retryThawJob(
      req.params.thawJobId,
      requestId,
      userId
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/lifecycle/apply', async (req: Request, res: Response) => {
  try {
    const { bucketName } = req.body;
    const userId = (req.headers['x-user-id'] as string) || 'system';
    const requestId = uuidv4();
    
    const results = await lifecycleService.applyLifecycleRules(
      bucketName,
      requestId,
      userId
    );
    
    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/process-thaw-jobs', async (req: Request, res: Response) => {
  try {
    const results = await thawService.processPendingThawJobs();
    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/advance-thaw/:thawJobId', async (req: Request, res: Response) => {
  try {
    const result = await thawService.advanceThawProgress(req.params.thawJobId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/expire-thaws', async (req: Request, res: Response) => {
  try {
    const results = await thawService.expireThawJobs();
    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { startTime, endTime, objectId } = req.query;
    
    if (objectId) {
      const logs = await loggingService.getLogsByObject(objectId as string);
      res.json({ success: true, data: logs });
    } else if (startTime && endTime) {
      const logs = await loggingService.getLogsByTimeRange(
        startTime as string,
        endTime as string
      );
      res.json({ success: true, data: logs });
    } else {
      const logs = await loggingService.getFailedOperations();
      res.json({ success: true, data: logs });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/export/operations', async (req: Request, res: Response) => {
  try {
    const { startTime, endTime } = req.body;
    const filepath = await exportService.exportOperationsReport(
      startTime,
      endTime
    );
    res.json({
      success: true,
      filepath,
      message: 'Operations report exported successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/export/failed', async (req: Request, res: Response) => {
  try {
    const filepath = await exportService.exportFailedOperationsReport();
    res.json({
      success: true,
      filepath,
      message: 'Failed operations report exported successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/test/setup', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    
    await lifecycleService.createObject({
      objectId: 'obj-001',
      bucketName: 'test-bucket',
      objectKey: 'documents/report-2023.pdf',
      size: 5 * 1024 * 1024 * 1024,
      storageClass: StorageClass.ARCHIVE,
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
      storageClass: StorageClass.STANDARD,
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
      storageClass: StorageClass.DEEP_ARCHIVE,
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
          action: LifecycleAction.TRANSITION,
          daysAfterCreation: 30,
          targetStorageClass: StorageClass.INFREQUENT_ACCESS
        },
        {
          action: LifecycleAction.TRANSITION,
          daysAfterCreation: 90,
          targetStorageClass: StorageClass.ARCHIVE
        }
      ],
      priority: 10,
      createdTime: now.toISOString(),
      lastModified: now.toISOString()
    });
    
    res.json({ success: true, message: 'Test data setup completed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
