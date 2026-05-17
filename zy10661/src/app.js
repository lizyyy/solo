const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { initDatabase } = require('./db');
const noticeRoutes = require('./routes/notices');
const { createClaim, listClaims } = require('./services/claimService');
const { importFromCsv, getBadRows } = require('./services/importExportService');
const { checkAndUpdateOverdue } = require('./services/noticeService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.get('/', (req, res) => {
  res.json({
    name: '保险理赔后台材料补交通知 API',
    version: '1.0.0',
    endpoints: {
      notices: '/api/notices',
      claims: '/api/claims',
      import: '/api/import/csv',
      export: '/api/notices/export/csv'
    }
  });
});

app.use('/api/notices', noticeRoutes);

app.get('/api/claims', (req, res) => {
  try {
    const claims = listClaims(req.query);
    res.json({ success: true, data: claims });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/claims', (req, res) => {
  try {
    const claim = createClaim(req.body);
    res.json({ success: true, data: claim });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传文件' });
    }
    const batchId = uuidv4();
    const result = await importFromCsv(req.file.path, batchId, req.body.operator_id);
    res.json({ success: true, data: { ...result, batchId } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/import/bad-rows', (req, res) => {
  try {
    const rows = getBadRows(req.query.batch_id);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/system/check-overdue', (req, res) => {
  try {
    const count = checkAndUpdateOverdue();
    res.json({ success: true, data: { updated: count } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`保险理赔后台材料补交通知 API 已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

module.exports = app;
