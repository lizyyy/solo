const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/errorHandler');

const importRoutes = require('./routes/importRoutes');
const reconciliationRoutes = require('./routes/reconciliationRoutes');
const discrepancyRoutes = require('./routes/discrepancyRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '服务运行正常',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

app.use('/api/v1/import', importRoutes);
app.use('/api/v1/reconciliation', reconciliationRoutes);
app.use('/api/v1/discrepancies', discrepancyRoutes);
app.use('/api/v1/review', reviewRoutes);
app.use('/api/v1/reports', reportRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
