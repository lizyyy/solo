const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const contractRoutes = require('./routes/contractRoutes');
const callbackRoutes = require('./routes/callbackRoutes');
const auditRoutes = require('./routes/auditRoutes');
const statsRoutes = require('./routes/statsRoutes');
const historyRoutes = require('./routes/historyRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/contracts', contractRoutes);
app.use('/api/callbacks', callbackRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/history', historyRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '电子签合同撤回 API',
    version: '1.0.0',
    description: '支持合同撤回、补签、拒签和重新发起的完整状态机流程',
    endpoints: {
      contracts: '/api/contracts',
      callbacks: '/api/callbacks',
      audits: '/api/audits',
      stats: '/api/stats',
      history: '/api/history',
      health: '/health'
    }
  });
});

app.use(errorHandler);

module.exports = app;
