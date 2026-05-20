const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const vulnerabilityRoutes = require('./routes/vulnerabilities');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/vulnerabilities', vulnerabilityRoutes);
app.use('/api/audit-logs', auditRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '漏洞包分诊台 API 运行正常', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
