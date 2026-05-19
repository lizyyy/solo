import express from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { initDatabase } from './database';
import { importRoomStatesFromCsv, importCleaningRecordsFromJson, getImportRecordsByBatch, getBatchInfo, getAllBatches } from './import/engine';
import { updateCleaningStatus, updateComplaintStatus, createComplaintFromCleaning, createReworkRecord, updateReworkStatus } from './workflow/state';
import { generateSettlementReport, exportReportToExcel, getDeductionRules } from './report/generator';
import { maskRoomState, maskCleaningRecord, maskComplaint, maskImportRecord, maskArray, createLogger } from './security/masking';
import { getAll, getOne, runQuery } from './database';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });
const logger = createLogger(process.env.LOG_LEVEL || 'info');

app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/import/room-state', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }
    
    const results: any[] = [];
    const stream = Readable.from(req.file.buffer.toString());
    
    stream.pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const importResult = await importRoomStatesFromCsv(results, req.file!.originalname);
        logger.info(`导入房态数据: ${importResult.batchId}, 有效: ${importResult.results.filter(r => r.isValid).length}, 无效: ${importResult.results.filter(r => !r.isValid).length}`);
        res.json({
          batchId: importResult.batchId,
          total: importResult.results.length,
          valid: importResult.results.filter(r => r.isValid).length,
          invalid: importResult.results.filter(r => !r.isValid).length,
          details: maskArray(importResult.results, maskImportRecord)
        });
      });
  } catch (error: any) {
    logger.error('导入房态数据失败', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/import/cleaning', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }
    
    const records = JSON.parse(req.file.buffer.toString());
    const importResult = await importCleaningRecordsFromJson(records, req.file.originalname);
    
    logger.info(`导入保洁数据: ${importResult.batchId}, 有效: ${importResult.results.filter(r => r.isValid).length}, 无效: ${importResult.results.filter(r => !r.isValid).length}`);
    
    res.json({
      batchId: importResult.batchId,
      total: importResult.results.length,
      valid: importResult.results.filter(r => r.isValid).length,
      invalid: importResult.results.filter(r => !r.isValid).length,
      details: maskArray(importResult.results, maskImportRecord)
    });
  } catch (error: any) {
    logger.error('导入保洁数据失败', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/import/batches', async (req, res) => {
  try {
    const batches = await getAllBatches();
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/import/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { isValid } = req.query;
    
    const [batchInfo, records] = await Promise.all([
      getBatchInfo(batchId),
      getImportRecordsByBatch(batchId, isValid !== undefined ? isValid === 'true' : undefined)
    ]);
    
    if (!batchInfo) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    res.json({
      batch: batchInfo,
      records: maskArray(records, maskImportRecord)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/room-states', async (req, res) => {
  try {
    const { date } = req.query;
    let sql = 'SELECT * FROM room_states';
    const params: any[] = [];
    
    if (date) {
      sql += ' WHERE date = ?';
      params.push(date);
    }
    sql += ' ORDER BY date DESC, room_number';
    
    const records = await getAll(sql, params);
    res.json(maskArray(records, maskRoomState));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/cleanings', async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    let sql = 'SELECT * FROM cleaning_records WHERE 1=1';
    const params: any[] = [];
    
    if (startDate && endDate) {
      sql += ' AND scheduled_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY scheduled_date DESC';
    
    const records = await getAll(sql, params);
    res.json(maskArray(records, maskCleaningRecord));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/cleanings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    
    await updateCleaningStatus(parseInt(id), status, remarks);
    logger.info(`更新保洁状态: ${id} -> ${status}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/complaints', async (req, res) => {
  try {
    const { cleaningId, category, description, guestName, guestPhone } = req.body;
    const id = await createComplaintFromCleaning(cleaningId, category, description, guestName, guestPhone);
    logger.info(`创建客诉记录: ${id}, 关联保洁: ${cleaningId}`);
    res.json({ id, success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/complaints', async (req, res) => {
  try {
    const records = await getAll('SELECT * FROM complaints ORDER BY complaint_date DESC');
    res.json(maskArray(records, maskComplaint));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/complaints/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, handler } = req.body;
    await updateComplaintStatus(parseInt(id), status, resolution, handler);
    logger.info(`更新客诉状态: ${id} -> ${status}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/reworks', async (req, res) => {
  try {
    const { cleaningId, reworkReason, reworkerName, reworkDate } = req.body;
    const id = await createReworkRecord(cleaningId, reworkReason, reworkerName, reworkDate);
    logger.info(`创建返工记录: ${id}, 关联保洁: ${cleaningId}`);
    res.json({ id, success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/reworks', async (req, res) => {
  try {
    const records = await getAll('SELECT * FROM rework_records ORDER BY rework_date DESC');
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/reworks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verificationRemarks } = req.body;
    await updateReworkStatus(parseInt(id), status, verificationRemarks);
    logger.info(`更新返工状态: ${id} -> ${status}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/report/settlement', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '请提供 startDate 和 endDate' });
    }
    
    const report = await generateSettlementReport(startDate as string, endDate as string);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/report/settlement/export', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '请提供 startDate 和 endDate' });
    }
    
    const report = await generateSettlementReport(startDate as string, endDate as string);
    const buffer = await exportReportToExcel(report);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="settlement-report-${startDate}-${endDate}.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/deduction-rules', async (req, res) => {
  try {
    const rules = await getDeductionRules();
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const startServer = async () => {
  try {
    await initDatabase();
    app.listen(port, () => {
      logger.info(`服务器运行在 http://localhost:${port}`);
    });
  } catch (error) {
    console.error('启动失败', error);
    process.exit(1);
  }
};

startServer();
