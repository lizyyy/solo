const express = require('express');
const cors = require('cors');
require('./database/db');

const annotationsRouter = require('./routes/annotations');
const metricsRouter = require('./routes/metrics');
const exportRouter = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/annotations', annotationsRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
