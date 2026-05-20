const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const batchesRouter = require('./routes/batches');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '社区矫正签到预警API',
    version: '1.0.0',
    description: '司法社工签到材料处理系统',
    endpoints: {
      'POST /api/batches': '提交批次材料进行处理',
      'GET /api/batches': '获取批次列表',
      'GET /api/batches/:batchId': '获取批次基本信息',
      'GET /api/batches/:batchId/results': '获取批次处理结果详情',
      'GET /api/batches/:batchId/stats': '获取批次统计信息',
      'GET /api/batches/:batchId/summaries': '获取批次每日汇总详情',
      'GET /api/batches/:batchId/export': '导出批次结果为CSV文件'
    }
  });
});

app.use('/api/batches', batchesRouter);

app.use((req, res) => {
  res.status(404).json({
    error: '未找到',
    message: '请求的接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`
============================================
  社区矫正签到预警API服务已启动
  服务地址: http://localhost:${PORT}
  数据库路径: ${path.join(dataDir, 'database.sqlite')}
============================================
  `);
});
