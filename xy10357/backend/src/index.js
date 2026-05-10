const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '药企样本寄送合规管理系统运行中' });
});

app.use('/api/institutions', require('./routes/institutions'));
app.use('/api/recipients', require('./routes/recipients'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/temperatures', require('./routes/temperatures'));
app.use('/api/destructions', require('./routes/destructions'));
app.use('/api/history', require('./routes/history'));
app.use('/api/export', require('./routes/export'));

app.use('/uploads', express.static(uploadsDir));

app.listen(PORT, () => {
  console.log(`药企样本寄送合规管理系统后端服务已启动: http://localhost:${PORT}`);
  console.log('API文档说明:');
  console.log('  GET  /api/health                 - 健康检查');
  console.log('  GET  /api/institutions           - 接收机构列表');
  console.log('  GET  /api/recipients             - 接收人列表');
  console.log('  GET  /api/batches                - 样本批次列表');
  console.log('  GET  /api/shipments              - 寄送申请列表');
  console.log('  GET  /api/temperatures           - 温控记录列表');
  console.log('  GET  /api/destructions           - 销毁回执列表');
  console.log('  GET  /api/history/:shipmentId    - 查看历史记录');
  console.log('  GET  /api/export/:shipmentId     - 导出合规包');
});
