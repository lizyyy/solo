const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadRoutes = require('./routes/upload');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

app.use('/api/upload', uploadRoutes(upload));

app.use(errorHandler);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '4S店车辆管理API运行正常' });
});

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📁 上传文件目录: ${uploadsDir}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
