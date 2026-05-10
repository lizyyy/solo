import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './config/logger';
import { requestLogger } from './middleware/request.logger';
import { errorHandler, notFoundHandler } from './middleware/error.handler';
import { successResponse } from './utils/response';

import accountRoutes from './routes/account.routes';
import batchRoutes from './routes/batch.routes';
import approvalRoutes from './routes/approval.routes';
import limitRoutes from './routes/limit.routes';
import refundRoutes from './routes/refund.routes';
import reportRoutes from './routes/report.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get('/health', (_req: Request, res: Response) => {
  return successResponse(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: env.nodeEnv,
  });
});

const apiPrefix = `/api/${env.apiVersion}`;

app.use(`${apiPrefix}/accounts`, accountRoutes);
app.use(`${apiPrefix}/batches`, batchRoutes);
app.use(`${apiPrefix}/approvals`, approvalRoutes);
app.use(`${apiPrefix}/limits`, limitRoutes);
app.use(`${apiPrefix}/refunds`, refundRoutes);
app.use(`${apiPrefix}/reports`, reportRoutes);

app.get('/', (_req: Request, res: Response) => {
  return successResponse(res, {
    name: 'Payment Batch API',
    description: '资金付款批次复核API后端系统',
    version: process.env.npm_package_version || '1.0.0',
    apiEndpoints: {
      accounts: `${apiPrefix}/accounts`,
      batches: `${apiPrefix}/batches`,
      approvals: `${apiPrefix}/approvals`,
      limits: `${apiPrefix}/limits`,
      refunds: `${apiPrefix}/refunds`,
      reports: `${apiPrefix}/reports`,
    },
    healthCheck: '/health',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
