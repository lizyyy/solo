import { Router, Request, Response } from 'express';
import multer from 'multer';
import { FileParser } from '../utils/fileParser';
import { dataProcessor } from '../services/DataProcessor';
import { batchManager } from '../services/BatchManager';
import { ruleEngine } from '../services/RuleEngine';
import { DataSourceType, UnifiedRecord } from '../types';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FileParser.getTempDir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  }
});

const upload = multer({ storage });

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'municipal-ops-api'
  });
});

router.get('/rules', (req: Request, res: Response) => {
  res.json({
    rules: ruleEngine.getRuleDescriptions()
  });
});

router.get('/batches', (req: Request, res: Response) => {
  res.json({
    batches: batchManager.getAllBatches()
  });
});

router.get('/batches/:batchId', (req: Request, res: Response) => {
  const info = batchManager.getBatchInfo(req.params.batchId);
  if (!info) {
    return res.status(404).json({ error: '批次不存在' });
  }
  res.json(info);
});

router.delete('/batches', (req: Request, res: Response) => {
  batchManager.clearAllBatches();
  res.json({ message: '已清空所有批次记录' });
});

router.post(
  '/upload/:sourceType',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const sourceType = req.params.sourceType as DataSourceType;
      
      if (!['alarm', 'inspection', 'maintenance'].includes(sourceType)) {
        return res.status(400).json({
          error: '无效的数据源类型，可选值: alarm, inspection, maintenance'
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: '未上传文件' });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const fileHash = FileParser.calculateFileHash(filePath);

      let records: UnifiedRecord[];
      
      if (originalName.endsWith('.csv')) {
        records = await FileParser.parseCSV(filePath, sourceType);
      } else if (originalName.endsWith('.json')) {
        records = FileParser.parseJSON(filePath, sourceType);
      } else {
        FileParser.cleanupFile(filePath);
        return res.status(400).json({ error: '不支持的文件格式，请上传CSV或JSON文件' });
      }

      FileParser.cleanupFile(filePath);

      const duplicateCheck = batchManager.checkBatchDuplicate(records, sourceType, fileHash);
      
      if (duplicateCheck.isDuplicate) {
        return res.json({
          message: '该批次数据已存在，不重复处理',
          duplicateBatchId: duplicateCheck.duplicateBatchId,
          duplicateCount: duplicateCheck.duplicateRecords,
          totalRecords: duplicateCheck.totalRecords
        });
      }

      const batchId = batchManager.generateBatchId(sourceType);
      const result = dataProcessor.processBatch(records, sourceType, batchId, fileHash);

      res.json({
        success: true,
        filename: originalName,
        fileHash,
        duplicateWarning: duplicateCheck.duplicateRecords > 0 ? {
          count: duplicateCheck.duplicateRecords,
          message: `批次内有${duplicateCheck.duplicateRecords}条记录与历史数据重复，已自动跳过`
        } : null,
        result
      });

    } catch (error: any) {
      console.error('处理文件失败:', error);
      res.status(500).json({
        error: '处理文件失败',
        message: error.message
      });
    }
  }
);

router.post('/process/:sourceType', (req: Request, res: Response) => {
  try {
    const sourceType = req.params.sourceType as DataSourceType;
    
    if (!['alarm', 'inspection', 'maintenance'].includes(sourceType)) {
      return res.status(400).json({
        error: '无效的数据源类型，可选值: alarm, inspection, maintenance'
      });
    }

    const records = req.body as UnifiedRecord[];
    
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '请求体应为记录数组' });
    }

    const batchHash = batchManager.calculateBatchHash(records, sourceType);
    const duplicateCheck = batchManager.checkBatchDuplicate(records, sourceType, batchHash);

    if (duplicateCheck.isDuplicate) {
      return res.json({
        message: '该批次数据已存在，不重复处理',
        duplicateBatchId: duplicateCheck.duplicateBatchId,
        duplicateCount: duplicateCheck.duplicateRecords,
        totalRecords: duplicateCheck.totalRecords
      });
    }

    const batchId = batchManager.generateBatchId(sourceType);
    const result = dataProcessor.processBatch(records, sourceType, batchId, batchHash);

    res.json({
      success: true,
      duplicateWarning: duplicateCheck.duplicateRecords > 0 ? {
        count: duplicateCheck.duplicateRecords,
        message: `批次内有${duplicateCheck.duplicateRecords}条记录与历史数据重复，已自动跳过`
      } : null,
      result
    });

  } catch (error: any) {
    console.error('处理数据失败:', error);
    res.status(500).json({
      error: '处理数据失败',
      message: error.message
    });
  }
});

router.post('/explain', (req: Request, res: Response) => {
  try {
    const { record, sourceType } = req.body;
    
    if (!record || !sourceType) {
      return res.status(400).json({ error: '缺少record或sourceType参数' });
    }

    const batchId = 'EXPLAIN_' + Date.now();
    const context = {
      allRecords: [record],
      sourceType,
      batchId
    };

    const ruleResults = ruleEngine.applyAllRules(record, context);
    const { status, suggestion } = ruleEngine.determineStatus(ruleResults);

    const processedRecord = {
      originalId: record.id || record.alarmId || record.inspectionId || record.orderId || 'unknown',
      sourceType,
      status,
      originalData: record,
      unifiedData: {
        poleId: record.poleId,
        lampId: record.lampId,
        location: record.location,
        time: record.alarmTime || record.inspectionTime || record.reportTime,
        type: record.alarmType || record.repairType || record.status
      },
      ruleResults,
      finalSuggestion: suggestion,
      isDuplicate: false
    };

    const explanation = dataProcessor.generateExplanation(processedRecord);

    res.json({
      status,
      ruleResults,
      suggestion,
      explanation,
      processedRecord
    });

  } catch (error: any) {
    console.error('生成说明失败:', error);
    res.status(500).json({
      error: '生成说明失败',
      message: error.message
    });
  }
});

export default router;
