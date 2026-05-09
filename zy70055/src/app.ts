import express from 'express';
import { APP_CONFIG } from './config';
import { errorHandler } from './middleware';
import {
  batchesRouter,
  feeRulesRouter,
  exceptionsRouter,
  reportsRouter,
  merchantsRouter,
} from './routes';
import { logger } from './utils/logger';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: APP_CONFIG.NODE_ENV,
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: '商户清算异常挂起服务',
    version: '1.0.0',
    endpoints: {
      batches: '/api/batches',
      feeRules: '/api/fee-rules',
      exceptions: '/api/exceptions',
      reports: '/api/reports',
      merchants: '/api/merchants',
    },
    flows: {
      normalFlow: 'POST /batches → POST /batches/:id/process → POST /reports/batches/:id/approve → POST /reports/batches/:id/generate → POST /reports/batches/:id/mark-paid',
      suspendFlow: 'POST /batches → POST /batches/:id/process [auto-suspend] → POST /exceptions/pending → POST /exceptions/:no/resolve → POST /batches/:id/unsuspend/request → POST /batches/:id/unsuspend/approve → 继续正常流程',
    },
  });
});

app.use('/api/batches', batchesRouter);
app.use('/api/fee-rules', feeRulesRouter);
app.use('/api/exceptions', exceptionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/merchants', merchantsRouter);

app.use(errorHandler);

export { app };
