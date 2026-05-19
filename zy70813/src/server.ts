import express from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

import {
  processImport,
  parseBerthsJSON,
  getImportBatch,
  getAllBatches,
  clearBatch
} from './services/import.service';

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/import', upload.fields([
  { name: 'schedules', maxCount: 1 },
  { name: 'berths', maxCount: 1 },
  { name: 'tides', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files.schedules || !files.berths) {
      return res.status(400).json({
        error: '缺少必要文件',
        message: '请提供船期CSV和泊位JSON文件'
      });
    }

    const schedulesFilePath = files.schedules[0].path;
    const berthsFilePath = files.berths[0].path;
    
    const berths = await parseBerthsJSON(berthsFilePath);
    
    const csvParser = require('./services/import.service');
    const schedules = await csvParser.parseCSV(schedulesFilePath);
    
    let tides: any[] = [];
    if (files.tides && files.tides[0]) {
      tides = await csvParser.parseTidesCSV(files.tides[0].path);
    }

    const result = await processImport(schedules, berths, tides);

    res.json({
      success: true,
      data: result,
      message: `导入完成：成功 ${result.normal.length} 条，待确认 ${result.pending.length} 条，失败 ${result.failed.length} 条，重复 ${result.duplicates} 条`
    });
  } catch (error: any) {
    console.error('导入错误:', error);
    res.status(500).json({
      error: '导入失败',
      message: error.message
    });
  }
});

app.post('/api/import/json', async (req, res) => {
  try {
    const { schedules, berths, tides = [] } = req.body;
    
    if (!schedules || !berths) {
      return res.status(400).json({
        error: '缺少必要数据',
        message: '请提供船期和泊位数据'
      });
    }

    const result = await processImport(schedules, berths, tides);

    res.json({
      success: true,
      data: result,
      message: `导入完成：成功 ${result.normal.length} 条，待确认 ${result.pending.length} 条，失败 ${result.failed.length} 条，重复 ${result.duplicates} 条`
    });
  } catch (error: any) {
    console.error('导入错误:', error);
    res.status(500).json({
      error: '导入失败',
      message: error.message
    });
  }
});

app.get('/api/batches', (req, res) => {
  const batches = getAllBatches();
  res.json({
    success: true,
    data: batches.map(b => ({
      batchId: b.batchId,
      importTime: b.importTime,
      recordCount: b.recordHashes.length,
      normalCount: b.result.normal.length,
      pendingCount: b.result.pending.length,
      failedCount: b.result.failed.length
    }))
  });
});

app.get('/api/batches/:batchId', (req, res) => {
  const batch = getImportBatch(req.params.batchId);
  
  if (!batch) {
    return res.status(404).json({
      error: '批次不存在',
      message: `未找到批次 ${req.params.batchId}`
    });
  }

  res.json({
    success: true,
    data: batch.result
  });
});

app.delete('/api/batches/:batchId', (req, res) => {
  const deleted = clearBatch(req.params.batchId);
  
  if (!deleted) {
    return res.status(404).json({
      error: '批次不存在',
      message: `未找到批次 ${req.params.batchId}`
    });
  }

  res.json({
    success: true,
    message: `批次 ${req.params.batchId} 已清除，记录可重新导入`
  });
});

app.get('/api/rules', (req, res) => {
  const { validationRules } = require('./services/validation.service');
  res.json({
    success: true,
    data: validationRules.map((r: any) => ({
      name: r.name,
      description: r.description
    }))
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          港口调度系统 API 服务器已启动                        ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                            ║
║  健康检查: http://localhost:${PORT}/health                      ║
║  API 文档: 见 README.md                                      ║
╠════════════════════════════════════════════════════════════╣
║  可用端点:                                                   ║
║    POST /api/import        - 文件上传导入                    ║
║    POST /api/import/json   - JSON数据导入                    ║
║    GET  /api/batches       - 获取所有批次                    ║
║    GET  /api/batches/:id   - 获取批次详情                    ║
║    DELETE /api/batches/:id - 清除批次（允许重跑）             ║
║    GET  /api/rules         - 获取验证规则                    ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;