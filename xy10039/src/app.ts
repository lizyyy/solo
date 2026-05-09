import express from 'express';
import cors from 'cors';
import path from 'path';

import {
  errorHandler,
  notFoundHandler
} from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import activityRoutes from './routes/activityRoutes';
import registrationRoutes from './routes/registrationRoutes';
import importExportRoutes from './routes/importExportRoutes';
import { logger } from './config/logger';

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  logger.info(`[${req.method}] ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/import-export', importExportRoutes);

app.use(
  '/exports',
  express.static(path.join(__dirname, '..', 'exports'))
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
