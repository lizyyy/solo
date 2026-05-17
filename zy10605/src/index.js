const express = require('express');
const path = require('path');
const fs = require('fs');

const FileStore = require('./storage/fileStore');
const ReplayService = require('./services/replayService');
const ExportService = require('./services/exportService');
const replayRoutes = require('./routes/replayRoutes');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const app = express();
app.use(express.json());

const store = new FileStore(DATA_DIR);
const replayService = new ReplayService(store);
const exportService = new ExportService(store);

app.use('/api/replay', replayRoutes(replayService, exportService));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dataDir: DATA_DIR
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '在线教育后端直播课回放解锁 API',
    endpoints: {
      health: 'GET /health',
      permissions: {
        list: 'GET /api/replay/permissions',
        create: 'POST /api/replay/permissions',
        detail: 'GET /api/replay/permissions/:id',
        unlock: 'POST /api/replay/permissions/:id/unlock',
        revoke: 'POST /api/replay/permissions/:id/revoke',
        expire: 'POST /api/replay/permissions/:id/expire',
        history: 'GET /api/replay/permissions/:id/history'
      },
      import: 'POST /api/replay/import',
      export: {
        permissions: 'GET /api/replay/export/permissions',
        history: 'GET /api/replay/export/permissions/:id/download',
        badRecords: 'GET /api/replay/export/bad-records'
      },
      badRecords: 'GET /api/replay/bad-records'
    }
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║            在线教育后端直播课回放解锁 API 服务                ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                             ║
║  数据目录: ${DATA_DIR}                                       ║
╠══════════════════════════════════════════════════════════════╣
║  验收测试: node src/acceptance.js                            ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
