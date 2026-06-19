const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');
const { store } = require('./store/FileStore');
const { historyManager } = require('./utils/history');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.use('/exports', express.static(path.join(process.cwd(), 'public', 'exports')));
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    globalSeq: store.getGlobalSeq(),
    dataFiles: Object.keys(require('./store/FileStore').STORE_FILES || {}).length
  });
});

function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`
============================================================
冷链库温区三维分层系统 - Web服务启动
============================================================
  本地地址: http://localhost:${port}
  API文档:  http://localhost:${port}/api/health
  3D视图:   http://localhost:${port}/#/3d
  图表视图:  http://localhost:${port}/#/chart
  导出列表:  http://localhost:${port}/#/exports
============================================================
`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('启动失败:', err.message);
    process.exit(1);
  });
}

module.exports = { app, startServer, PORT };
