require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const ruleVersionsRouter = require('./routes/ruleVersions');
const sampleSetsRouter = require('./routes/sampleSets');
const sandboxRunsRouter = require('./routes/sandboxRuns');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/rule-versions', ruleVersionsRouter);
app.use('/api/sample-sets', sampleSetsRouter);
app.use('/api/sandbox-runs', sandboxRunsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/business-sandbox';

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API endpoints:`);
      console.log(`  GET  /api/health`);
      console.log(`  GET  /api/rule-versions`);
      console.log(`  POST /api/rule-versions`);
      console.log(`  GET  /api/sample-sets`);
      console.log(`  POST /api/sample-sets`);
      console.log(`  GET  /api/sandbox-runs`);
      console.log(`  POST /api/sandbox-runs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
