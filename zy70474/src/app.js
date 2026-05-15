const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const acceptanceRoutes = require('./routes/acceptance');
const queryRoutes = require('./routes/query');
const batchRoutes = require('./routes/batch');
const inspectionRoutes = require('./routes/inspection');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/acceptance', acceptanceRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/inspection', inspectionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'stuck-task-cleaner' });
});

app.listen(PORT, () => {
  console.log(`滞留任务清理器服务启动成功，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;