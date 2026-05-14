const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./models/database');

const tenantsRouter = require('./routes/tenants');
const apiGroupsRouter = require('./routes/apiGroups');
const quotasRouter = require('./routes/quotas');
const rateLimitRouter = require('./routes/rateLimit');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/tenants', tenantsRouter);
app.use('/api/api-groups', apiGroupsRouter);
app.use('/api/quotas', quotasRouter);
app.use('/api/rate-limit', rateLimitRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`接口限流账本后端服务运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
