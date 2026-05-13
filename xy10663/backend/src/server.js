const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const appointmentsRouter = require('./routes/appointments');
const importRouter = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/api/appointments', appointmentsRouter);
app.use('/api/import', importRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '门诊检验预约服务运行正常' });
});

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: '请先构建前端项目' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 门诊检验预约报告系统已启动`);
  console.log(`📊 后端服务运行在: http://localhost:${PORT}`);
  console.log(`🔗 API文档: http://localhost:${PORT}/api/health`);
  console.log(`\n📋 使用说明:`);
  console.log(`  1. 初始化数据库: npm run init-db`);
  console.log(`  2. 生成演示数据: npm run seed-data`);
  console.log(`  3. 开发模式: npm run dev`);
  console.log(``);
});
