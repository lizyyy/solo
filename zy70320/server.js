const express = require('express');
const bodyParser = require('body-parser');
const metricsRoutes = require('./routes/metrics');
const diagnosticRoutes = require('./routes/diagnostic');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use('/api/v1', metricsRoutes);
app.use('/api/v1', diagnosticRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`队列积压根因诊断API服务已启动: http://localhost:${PORT}`);
});
