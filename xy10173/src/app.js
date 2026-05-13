const express = require('express');
const { initSchema } = require('./database/schema');
const { initDatabase } = require('./config/database');
const membersRoute = require('./routes/members');
const pointsRoute = require('./routes/points');
const { errorHandler } = require('./middleware/errorHandler');

let app = null;

async function createApp() {
  if (app) return app;
  
  await initDatabase();
  await initSchema();
  
  app = express();
  app.use(express.json());
  
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'points-freeze-api',
        status: 'ok',
        timestamp: Date.now()
      }
    });
  });
  
  app.use('/api/v1/members', membersRoute);
  app.use('/api/v1/points', pointsRoute);
  
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '接口不存在'
      }
    });
  });
  
  app.use(errorHandler);
  
  return app;
}

function resetApp() {
  app = null;
}

module.exports = createApp;
module.exports.resetApp = resetApp;
