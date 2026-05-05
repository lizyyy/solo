import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import interfacesRouter from './routes/interfaces.js';
import trafficModelsRouter from './routes/traffic-models.js';
import testBatchesRouter from './routes/test-batches.js';
import testResultsRouter from './routes/test-results.js';
import monitoringRouter from './routes/monitoring.js';
import tasksRouter from './routes/tasks.js';
import reportsRouter from './routes/reports.js';
import analysisRouter from './routes/analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/interfaces', interfacesRouter);
app.use('/api/traffic-models', trafficModelsRouter);
app.use('/api/test-batches', testBatchesRouter);
app.use('/api/test-results', testResultsRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/analysis', analysisRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`压测看板服务运行在 http://localhost:${PORT}`);
});
