const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./config/database');
const TokenStrategy = require('./models/TokenStrategy');

const tasksRoutes = require('./routes/tasks');
const contextRoutes = require('./routes/context');
const strategiesRoutes = require('./routes/strategies');
const evaluationsRoutes = require('./routes/evaluations');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/tasks', tasksRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/evaluations', evaluationsRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'LLM Context Evaluator API is running',
    timestamp: new Date().toISOString()
  });
});

app.use(express.static(path.join(__dirname, '../../frontend/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  if (err.message.includes('File too large')) {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum size is 50MB.'
    });
  }
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

async function startServer() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    console.log('Initializing default strategies...');
    TokenStrategy.initDefaultStrategies();
    
    app.listen(PORT, () => {
      console.log(`🚀 LLM Context Evaluator Backend running on port ${PORT}`);
      console.log(`📊 API endpoint: http://localhost:${PORT}/api`);
      console.log(`💊 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
