const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const importRoutes = require('./routes/import');
const reviewRoutes = require('./routes/review');
const reportRoutes = require('./routes/reports');
const sampleRoutes = require('./routes/sample');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/import', importRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sample', sampleRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '音乐课作业节奏批改系统',
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  音乐课作业节奏批改系统 已启动');
  console.log('========================================');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log('');
  console.log('  主要功能:');
  console.log('  1. 音频文件备注导入');
  console.log('  2. 授权期限页数据补充');
  console.log('  3. 冲突检测与人工确认');
  console.log('  4. 复核历史追踪');
  console.log('  5. 店长周报生成');
  console.log('');
});

module.exports = app;
