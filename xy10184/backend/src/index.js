const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');

require('./database');

const authRoutes = require('./routes/auth');
const appealRoutes = require('./routes/appeals');
const attachmentRoutes = require('./routes/attachments');
const logRoutes = require('./routes/logs');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  createParentPath: true
}));

app.use('/api/auth', authRoutes);
app.use('/api/appeals', appealRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'dist')));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
  }
});

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(err.status || 500).json({ 
    error: err.message || '服务器内部错误' 
  });
});

app.listen(PORT, () => {
  console.log(`内容审核申诉工作台 - 后端服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
