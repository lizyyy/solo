const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const studentsRouter = require('./routes/students');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/levels', (req, res) => {
  res.json(['入门班', '初级班', '中级班', '高级班', '精英班']);
});

app.get('/teacher-tags', (req, res) => {
  res.json({
    positive: ['战术出色', '防守稳健', '进攻主动', '思维敏捷', '计算能力强', '心态稳定', '进步明显'],
    negative: ['失误较多', '时间管理差', '战术单一', '防守薄弱', '心理波动大', '基本功不扎实']
  });
});

app.use('/api/students', studentsRouter);

app.listen(PORT, () => {
  console.log(`🚀 棋类培训升班评估器已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📚 API文档示例:`);
  console.log(`   GET  /api/students          - 获取所有学生`);
  console.log(`   POST /api/students          - 新增学生`);
  console.log(`   GET  /api/students/:id/winrate   - 胜率趋势`);
  console.log(`   POST /api/students/:id/evaluate  - 执行评估`);
  console.log(`   GET  /api/students/:id/report    - 家长报告`);
});

module.exports = app;
