const express = require('express');
const cors = require('cors');
const path = require('path');
const samplesRouter = require('./routes/samples');
const { createInitialSamples } = require('./scripts/initData');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

createInitialSamples();

app.use('/api/samples', samplesRouter);

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: '糕点中央厨房留样管理API运行正常',
    timestamp: new Date().toISOString(),
    endpoints: {
      'GET /api/samples': '获取所有留样记录',
      'GET /api/samples/statistics': '获取统计信息',
      'GET /api/samples/:id': '获取单个留样详情',
      'GET /api/samples/boxcode/:code': '按留样盒编号查询',
      'POST /api/samples': '创建留样记录',
      'PATCH /api/samples/:id/status': '更新留样状态',
      'PATCH /api/samples/:id/inspection': '提交检验结果',
      'GET /api/samples/:id/allowed-actions': '获取允许的状态转换'
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`糕点中央厨房留样管理API已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API状态: http://localhost:${PORT}/api/status`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});

module.exports = app;
