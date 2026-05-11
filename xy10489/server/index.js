const express = require('express');
const cors = require('cors');
const path = require('path');
const { readDB, writeDB, sampleData, getTimestamp } = require('./database');
const { createBatchRouter } = require('./routes/batches');
const { createDefectRouter } = require('./routes/defects');
const { createReworkRouter } = require('./routes/rework');
const { createReportsRouter } = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

sampleData();

app.use('/api/batches', createBatchRouter());
app.use('/api/defects', createDefectRouter());
app.use('/api/rework', createReworkRouter());
app.use('/api/reports', createReportsRouter());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '品控抽检复判台系统运行正常' });
});

app.post('/api/init-sample', (req, res) => {
  sampleData();
  res.json({ success: true, message: '样例数据已初始化' });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`品控抽检复判台系统运行在 http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});
