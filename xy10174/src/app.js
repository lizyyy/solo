const express = require('express');
const { runMigrations } = require('./db/knex');

const budgetLocksRoutes = require('./routes/budget-locks');
const approvalsRoutes = require('./routes/approvals');
const reportsRoutes = require('./routes/reports');

async function createApp() {
  await runMigrations();
  
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });
  
  app.use('/api/budget', budgetLocksRoutes);
  app.use('/api/approvals', approvalsRoutes);
  app.use('/api/reports', reportsRoutes);
  
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      code: 9999,
      message: '服务器内部错误',
      timestamp: Date.now()
    });
  });
  
  return app;
}

module.exports = createApp;
