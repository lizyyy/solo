const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const dataSourcesRouter = require('./routes/dataSources');
const crawlBatchesRouter = require('./routes/crawlBatches');
const snippetsRouter = require('./routes/snippets');
const refreshTasksRouter = require('./routes/refreshTasks');
const alertsRouter = require('./routes/alerts');
const reportsRouter = require('./routes/reports');
const freshnessRulesRouter = require('./routes/freshnessRules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/data-sources', dataSourcesRouter);
app.use('/api/crawl-batches', crawlBatchesRouter);
app.use('/api/snippets', snippetsRouter);
app.use('/api/refresh-tasks', refreshTasksRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/freshness-rules', freshnessRulesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`RAG 来源新鲜度台已启动: http://localhost:${PORT}`);
});
