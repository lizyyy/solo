const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const incidentRoutes = require('./routes/incidentRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/incident-review';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
}).catch(err => {
  console.log('\n===========================================================');
  console.log('⚠️  MongoDB 连接失败！');
  console.log('===========================================================');
  console.log('错误信息:', err.message);
  console.log('\n请确保 MongoDB 已启动:');
  console.log('  - MacOS (brew):  brew services start mongodb-community');
  console.log('  - Docker:        docker run -d -p 27017:27017 mongo:latest');
  console.log('===========================================================\n');
});

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('MongoDB 错误:', err.message);
});
db.once('open', () => {
  console.log('✅ 已连接到 MongoDB');
});

app.get('/api/health', (req, res) => {
  const status = db.readyState === 1 ? 'healthy' : 'unhealthy';
  res.json({
    status,
    mongodb: status === 'healthy' ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/incidents', incidentRoutes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  res.status(500).json({ error: '服务器内部错误: ' + err.message });
});

app.listen(PORT, () => {
  console.log('\n===========================================================');
  console.log(`🚀 事故复盘资料系统后端已启动`);
  console.log('===========================================================');
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log('===========================================================\n');
});
