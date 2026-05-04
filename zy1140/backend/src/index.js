const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs-extra');

const dataRouter = require('./routes/data');
const importRouter = require('./routes/import');
const notesRouter = require('./routes/notes');
const thresholdsRouter = require('./routes/thresholds');
const anomaliesRouter = require('./routes/anomalies');
const reportRouter = require('./routes/report');

const { initDatabase } = require('./database');
const { ensureDirectories } = require('./utils/file');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_DIR = path.join(DATA_DIR, 'db');

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/data', dataRouter);
app.use('/api/import', importRouter);
app.use('/api/notes', notesRouter);
app.use('/api/thresholds', thresholdsRouter);
app.use('/api/anomalies', anomaliesRouter);
app.use('/api/report', reportRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/status', (req, res) => {
  const dbExists = fs.existsSync(path.join(DB_DIR, 'health.db'));
  res.json({
    initialized: dbExists,
    dataDir: DATA_DIR,
    uploadDir: UPLOAD_DIR,
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

async function startServer() {
  try {
    await ensureDirectories([DATA_DIR, UPLOAD_DIR, DB_DIR]);
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Apple Health Dashboard Backend`);
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`💾 Data directory: ${DATA_DIR}`);
      console.log(`📝 API Docs available at /api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});
