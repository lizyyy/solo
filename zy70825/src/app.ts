import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { FileParserService } from './services/fileParser';
import { RulesEngineService } from './services/rulesEngine';
import { DataStoreService } from './services/dataStore';
import { UploadBatch } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

const fileParser = new FileParserService();
const rulesEngine = new RulesEngineService();
const dataStore = new DataStoreService();

app.use(express.json());
app.use('/photos', express.static(path.join(process.cwd(), 'data', 'photos')));

app.post('/api/upload/shipments', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const fileName = req.file.originalname;
    if (await dataStore.isBatchProcessed(fileName)) {
      return res.status(400).json({ error: '该批次文件已处理过，不能重复提交' });
    }

    const batchId = uuidv4();
    const shipments = await fileParser.parseShipmentCSV(req.file.path, batchId);
    
    const influencers = await dataStore.getInfluencers();
    const existingShipments = await dataStore.getAllShipments();
    
    const result = rulesEngine.processItems(shipments, influencers, existingShipments);
    
    const batch: UploadBatch = {
      id: batchId,
      fileName,
      uploadTime: new Date().toISOString(),
      itemCount: shipments.length,
      processed: true
    };
    
    await dataStore.saveBatch(batch);
    await dataStore.saveShipments(shipments);
    await dataStore.saveProcessingResult(result);
    
    res.json({
      success: true,
      batchId,
      message: `处理完成，共 ${shipments.length} 条记录`,
      statistics: result.statistics
    });
  } catch (error) {
    console.error('处理失败:', error);
    res.status(500).json({ error: '处理失败' });
  }
});

app.post('/api/upload/influencers', upload.single('jsonFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }

    const influencers = await fileParser.parseInfluencerJSON(req.file.path);
    await dataStore.saveInfluencers(influencers);
    
    res.json({
      success: true,
      message: `导入成功，共 ${influencers.size} 位达人`
    });
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({ error: '导入失败' });
  }
});

app.post('/api/upload/photos', upload.array('photos', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请上传照片' });
    }

    const photoUrls: string[] = [];
    for (const file of files) {
      const fileName = `${uuidv4()}-${file.originalname}`;
      const buffer = await import('fs').then(fs => fs.promises.readFile(file.path));
      const url = await dataStore.savePhoto(fileName, buffer);
      photoUrls.push(url);
    }
    
    res.json({
      success: true,
      photoUrls
    });
  } catch (error) {
    console.error('上传失败:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

app.get('/api/results', async (req, res) => {
  try {
    const results = await dataStore.getProcessingResults();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

app.get('/api/results/:batchId', async (req, res) => {
  try {
    const result = await dataStore.getProcessingResultById(req.params.batchId);
    if (!result) {
      return res.status(404).json({ error: '未找到该批次' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

app.get('/api/report/:shipmentId', async (req, res) => {
  try {
    const report = await dataStore.getReportDetail(req.params.shipmentId);
    if (!report) {
      return res.status(404).json({ error: '未找到该记录' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

app.get('/api/batches', async (req, res) => {
  try {
    const batches = await dataStore.getBatches();
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

app.get('/api/shipments', async (req, res) => {
  try {
    const shipments = await dataStore.getAllShipments();
    res.json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

app.get('/api/influencers', async (req, res) => {
  try {
    const influencers = await dataStore.getInfluencers();
    res.json({ success: true, data: Array.from(influencers.values()) });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

app.listen(PORT, async () => {
  await import('fs-extra').then(fs => fs.ensureDir(path.join(process.cwd(), 'uploads')));
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API文档:');
  console.log('  POST /api/upload/shipments   - 上传寄送单CSV');
  console.log('  POST /api/upload/influencers - 上传达人档案JSON');
  console.log('  POST /api/upload/photos      - 上传回收照片');
  console.log('  GET  /api/results            - 获取所有处理结果');
  console.log('  GET  /api/results/:batchId   - 获取批次处理结果');
  console.log('  GET  /api/report/:shipmentId - 获取单条明细报告');
  console.log('  GET  /api/batches            - 获取批次列表');
  console.log('  GET  /api/shipments          - 获取所有寄送记录');
  console.log('  GET  /api/influencers        - 获取所有达人');
});
