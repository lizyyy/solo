import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { BatchController } from '../controllers/BatchController';
import batchService from '../services/BatchService';
import dataStore from '../models/DataStore';
import { FileParser } from '../utils/FileParser';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/csv' || 
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 CSV 文件'));
    }
  }
});

router.post('/batches', BatchController.createBatch);
router.post('/batches/:batchId/process', BatchController.processBatch);

router.post('/batches/:batchId/upload', 
  upload.single('receipts'),
  async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const { operator, activityCode, members } = req.body;
      
      if (!operator || !activityCode) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：operator, activityCode'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传 CSV 文件'
        });
      }

      const activityRule = dataStore.getActivityRule(activityCode);
      if (!activityRule) {
        return res.status(404).json({
          success: false,
          message: '活动规则不存在'
        });
      }

      const batch = dataStore.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({
          success: false,
          message: '批次不存在'
        });
      }

      const receipts = await FileParser.parseReceiptsCSVFromBuffer(req.file.buffer);
      
      const parsedMembers = members ? FileParser.parseMembersFromJSON(JSON.parse(members)) : [];
      
      const result = batchService.processBatch(
        batchId,
        receipts,
        parsedMembers,
        activityRule,
        operator
      );

      res.json({
        success: true,
        data: {
          ...result,
          fileName: req.file.originalname,
          fileSize: req.file.size
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

router.post('/records/:recordId/approve', BatchController.approveRecord);
router.post('/records/:recordId/reject', BatchController.rejectRecord);
router.post('/records/:recordId/return', BatchController.returnRecord);

router.get('/batches', BatchController.getAllBatches);
router.get('/batches/:batchId', BatchController.getBatch);
router.get('/batches/:batchId/records', BatchController.getBatchRecords);
router.get('/batches/:batchId/stats', BatchController.getBatchStats);
router.get('/batches/:batchId/export', BatchController.exportBatchRecords);

router.get('/records/:recordId/explanation', BatchController.getRecordExplanation);
router.get('/records/:recordId/audit-trail', BatchController.getRecordAuditTrail);

router.get('/records/query', BatchController.queryRecords);
router.get('/records/export', BatchController.exportRecords);

router.get('/logs', BatchController.getOperationLogs);

router.post('/activity-rules', BatchController.createActivityRule);
router.get('/activity-rules', BatchController.getAllActivityRules);

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: `文件上传错误: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
});

export default router;
