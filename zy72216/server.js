const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const recordsRoutes = require('./routes/records');
const exportRoutes = require('./routes/export');
const rulesRoutes = require('./routes/rules');

app.use('/api/records', recordsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/rules', rulesRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '私募持仓穿透核对系统运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '私募持仓穿透核对系统 API',
    endpoints: {
      records: {
        list: 'GET /api/records',
        detail: 'GET /api/records/:id',
        import: 'POST /api/records/import',
        manual_change: 'POST /api/records/:id/manual-change',
        upload_screenshot: 'POST /api/records/:id/screenshot',
        update_note: 'POST /api/records/:id/note',
        manager_review: 'POST /api/records/:id/manager-review',
        finalize: 'POST /api/records/:id/finalize',
        revert: 'POST /api/records/:id/revert'
      },
      export: {
        json: 'GET /api/export/json',
        excel: 'GET /api/export/excel',
        csv: 'GET /api/export/csv'
      },
      rules: {
        all: 'GET /api/rules',
        t1_to_t2: 'GET /api/rules/t1-to-t2',
        transitions: 'GET /api/rules/transitions'
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║     私募持仓穿透核对系统 已启动                             ║
  ║     服务地址: http://localhost:${PORT}                        ║
  ║     前端页面: http://localhost:${PORT}                        ║
  ║     API 文档: http://localhost:${PORT}/api                    ║
  ║     规则查询: http://localhost:${PORT}/api/rules              ║
  ╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
