const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const config = require('./config');
const db = require('./database');
const rateLimitRoutes = require('./routes/rateLimitRoutes');
const configRoutes = require('./routes/configRoutes');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/rate-limit', rateLimitRoutes);
app.use('/api/config', configRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

async function startServer() {
  try {
    await db.init();
    console.log('Database initialized successfully');

    const server = app.listen(config.server.port, config.server.host, () => {
      console.log(`Rate Limit Validator Service running on http://${config.server.host}:${config.server.port}`);
      console.log(`Health check: http://${config.server.host}:${config.server.port}/health`);
      console.log(`API Base: http://${config.server.host}:${config.server.port}/api`);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        db.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        db.close();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
