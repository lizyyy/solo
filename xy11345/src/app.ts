import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { apiKeyAuth } from './middleware/auth';
import batchRoutes from './routes/batchRoutes';
import auditRoutes from './routes/auditRoutes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);
app.use('/api', apiKeyAuth);

app.use('/api/batches', batchRoutes);
app.use('/api/audit-logs', auditRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'QC System API is running',
    timestamp: Date.now(),
    requestId: req.headers['x-request-id'],
  });
});

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    timestamp: Date.now(),
    requestId: req.headers['x-request-id'],
  });
});

export default app;
