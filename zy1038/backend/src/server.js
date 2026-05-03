import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import usersRouter from './routes/users.js';
import segmentsRouter from './routes/segments.js';
import flagsRouter from './routes/flags.js';
import evaluationRouter from './routes/evaluation.js';
import auditRouter from './routes/audit.js';
import importExportRouter from './routes/importExport.js';
import reportRouter from './routes/report.js';

import { storageService } from './services/storage.js';
import { initSampleData } from './services/sampleData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', async (req, res) => {
  try {
    const [users, segments, flags, audit] = await Promise.all([
      storageService.getUsers(),
      storageService.getSegments(),
      storageService.getFlags(),
      storageService.getAuditLogs()
    ]);

    res.json({
      users: users.length,
      segments: segments.length,
      flags: flags.length,
      audit: audit.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/init-sample', async (req, res) => {
  try {
    await initSampleData();
    res.json({ success: true, message: 'Sample data initialized' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use('/api/users', usersRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/flags', flagsRouter);
app.use('/api/evaluation', evaluationRouter);
app.use('/api/audit', auditRouter);
app.use('/api', importExportRouter);
app.use('/api/report', reportRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const startServer = async () => {
  try {
    const users = await storageService.getUsers();
    if (users.length === 0) {
      console.log('No data found, initializing sample data...');
      await initSampleData();
      console.log('Sample data initialized.');
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }

  app.listen(PORT, () => {
    console.log(`Feature Flag Simulator Backend running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
  });
};

startServer();
