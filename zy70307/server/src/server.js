const express = require('express');
const cors = require('cors');
const path = require('path');

const tenantsRouter = require('./routes/tenants');
const interfaceGroupsRouter = require('./routes/interfaceGroups');
const rulesRouter = require('./routes/rules');
const releasesRouter = require('./routes/releases');
const hitLogsRouter = require('./routes/hitLogs');
const { loadData } = require('./utils/dataStore');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

loadData();

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '错峰限流策略台服务运行正常', timestamp: new Date().toISOString() });
});

app.get('/api/regions', (req, res) => {
  const data = loadData();
  res.json({ success: true, data: data.regions });
});

app.use('/api/tenants', tenantsRouter);
app.use('/api/interface-groups', interfaceGroupsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/releases', releasesRouter);
app.use('/api/hit-logs', hitLogsRouter);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  错峰限流策略台后端服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`========================================\n`);
});
