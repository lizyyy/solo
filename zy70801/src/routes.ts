import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  parseCriticalValueCSV,
  parseCallbackJSON,
  parseDutyCSV,
  parseConfirmJSON
} from './services/parser.service';
import {
  createBatch,
  processCriticalValueBatch,
  saveCallbackRecords,
  saveDutyRecords,
  saveConfirmRecords,
  createSingleConfirmRecord,
  getBatchById,
  getBatchRecords,
  getAllBatches,
  updateBatchStatus
} from './services/batch.service';
import { getHistoryForReview } from './services/rules-engine.service';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/upload/critical-value', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const { batch, isDuplicate, existingBatch } = await createBatch(
      'critical_value',
      req.file.originalname,
      req.file.path
    );

    if (isDuplicate) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({
        error: '文件已存在，重复提交',
        existingBatch: {
          id: existingBatch?.id,
          batchNo: existingBatch?.batchNo,
          createdAt: existingBatch?.createdAt,
          recordCount: existingBatch?.recordCount
        }
      });
    }

    const records = await parseCriticalValueCSV(req.file.path, batch.id);
    const result = await processCriticalValueBatch(batch.id, records);

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      batchNo: batch.batchNo,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ error: '处理失败', message: error.message });
  }
});

router.post('/upload/callback', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const { batch, isDuplicate, existingBatch } = await createBatch(
      'callback',
      req.file.originalname,
      req.file.path
    );

    if (isDuplicate) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({
        error: '文件已存在，重复提交',
        existingBatch: {
          id: existingBatch?.id,
          batchNo: existingBatch?.batchNo,
          createdAt: existingBatch?.createdAt
        }
      });
    }

    const records = await parseCallbackJSON(req.file.path, batch.id);
    await updateBatchStatus(batch.id, 'processing', records.length, 0);
    await saveCallbackRecords(records);
    await updateBatchStatus(batch.id, 'completed', records.length, records.length);

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      batchId: batch.id,
      batchNo: batch.batchNo,
      recordCount: records.length,
      records
    });
  } catch (error: any) {
    res.status(500).json({ error: '处理失败', message: error.message });
  }
});

router.post('/upload/duty', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const { batch, isDuplicate, existingBatch } = await createBatch(
      'duty',
      req.file.originalname,
      req.file.path
    );

    if (isDuplicate) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({
        error: '文件已存在，重复提交',
        existingBatch: {
          id: existingBatch?.id,
          batchNo: existingBatch?.batchNo,
          createdAt: existingBatch?.createdAt
        }
      });
    }

    const records = await parseDutyCSV(req.file.path, batch.id);
    await updateBatchStatus(batch.id, 'processing', records.length, 0);
    await saveDutyRecords(records);
    await updateBatchStatus(batch.id, 'completed', records.length, records.length);

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      batchId: batch.id,
      batchNo: batch.batchNo,
      recordCount: records.length,
      records
    });
  } catch (error: any) {
    res.status(500).json({ error: '处理失败', message: error.message });
  }
});

router.post('/upload/confirm', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const { batch, isDuplicate, existingBatch } = await createBatch(
      'critical_value' as any,
      req.file.originalname,
      req.file.path
    );

    if (isDuplicate) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({
        error: '文件已存在，重复提交',
        existingBatch: {
          id: existingBatch?.id,
          batchNo: existingBatch?.batchNo,
          createdAt: existingBatch?.createdAt
        }
      });
    }

    const records = await parseConfirmJSON(req.file.path, batch.id);
    await updateBatchStatus(batch.id, 'processing', records.length, 0);
    await saveConfirmRecords(records);
    await updateBatchStatus(batch.id, 'completed', records.length, records.length);

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      batchId: batch.id,
      batchNo: batch.batchNo,
      recordCount: records.length,
      records
    });
  } catch (error: any) {
    res.status(500).json({ error: '处理失败', message: error.message });
  }
});

router.post('/confirm', async (req, res) => {
  try {
    const { criticalValueId, confirmTime, confirmer, confirmerPhone, confirmResult, confirmNote } = req.body;

    if (!criticalValueId || !confirmer || !confirmResult) {
      return res.status(400).json({ error: '缺少必填字段: criticalValueId, confirmer, confirmResult' });
    }

    const record = await createSingleConfirmRecord({
      criticalValueId,
      confirmTime: confirmTime || new Date().toISOString(),
      confirmer,
      confirmerPhone: confirmerPhone || '',
      confirmResult,
      confirmNote
    });

    res.json({
      success: true,
      record
    });
  } catch (error: any) {
    res.status(500).json({ error: '处理失败', message: error.message });
  }
});

router.get('/batches', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const batches = await getAllBatches(limit);
    res.json({ success: true, batches });
  } catch (error: any) {
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

router.get('/batches/:batchId', async (req, res) => {
  try {
    const batch = await getBatchById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const status = req.query.status as string;
    const records = await getBatchRecords(req.params.batchId, status);

    res.json({
      success: true,
      batch,
      records
    });
  } catch (error: any) {
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

router.get('/critical-values/:id/review', async (req, res) => {
  try {
    const history = await getHistoryForReview(req.params.id);
    if (!history) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({
      success: true,
      ...history
    });
  } catch (error: any) {
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const { all } = require('./db');
    
    const criticalStats = await all(`
      SELECT status, COUNT(*) as count 
      FROM critical_values 
      GROUP BY status
    `);

    const batchStats = await all(`
      SELECT status, COUNT(*) as count 
      FROM batches 
      GROUP BY status
    `);

    const totalCallbacks = await all('SELECT COUNT(*) as count FROM callback_records');
    const totalDuties = await all('SELECT COUNT(*) as count FROM duty_records');

    res.json({
      success: true,
      statistics: {
        criticalValues: criticalStats,
        batches: batchStats,
        totalCallbacks: totalCallbacks[0]?.count || 0,
        totalDuties: totalDuties[0]?.count || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

export default router;
