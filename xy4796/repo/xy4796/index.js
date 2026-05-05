require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initDatabase } = require('./config/database');

const benchmarksRouter = require('./routes/benchmarks');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Benchmark Tracker API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      benchmarks: {
        import: 'POST /api/benchmarks/import',
        list: 'GET /api/benchmarks',
        get: 'GET /api/benchmarks/:runId',
        compare: 'POST /api/benchmarks/compare',
        getComparison: 'GET /api/benchmarks/compare/:comparisonId',
        listComparisons: 'GET /api/benchmarks/comparisons'
      },
      audit: {
        addTag: 'POST /api/audit/tags',
        getTags: 'GET /api/audit/tags/:runId',
        updateNotes: 'PUT /api/audit/notes/:runId'
      }
    }
  });
});

app.use('/api/benchmarks', benchmarksRouter);
app.use('/api/audit', auditRouter);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API docs: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
