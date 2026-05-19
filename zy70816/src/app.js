const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const batchesRoute = require('./routes/batches');
const approvalsRoute = require('./routes/approvals');
const transfersRoute = require('./routes/transfers');
const inventoryRoute = require('./routes/inventory');
const exportsRoute = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/batches', batchesRoute);
app.use('/api/approvals', approvalsRoute);
app.use('/api/transfers', transfersRoute);
app.use('/api/inventory', inventoryRoute);
app.use('/api/exports', exportsRoute);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '口腔连锁采购追踪系统运行正常' });
});

app.get('/', (req, res) => {
  res.json({
    name: '口腔连锁采购追踪系统',
    version: '1.0.0',
    description: '支持库存CSV、召回公告Markdown、门店消耗表接入，生成可追踪记录',
    endpoints: {
      batches: '/api/batches',
      approvals: '/api/approvals',
      transfers: '/api/transfers',
      inventory: '/api/inventory',
      exports: '/api/exports',
      health: '/api/health'
    }
  });
});

app.listen(PORT, () => {
  console.log(`口腔连锁采购追踪系统已启动，运行在 http://localhost:${PORT}`);
  console.log('初始化数据库，请运行: npm run init-db');
  console.log('加载样例数据，请运行: npm run sample-data');
});

module.exports = app;
