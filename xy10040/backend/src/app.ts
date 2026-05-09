import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';

import { requestContextMiddleware } from './middleware/request-context';
import { idempotencyMiddleware } from './middleware/idempotency';
import {
  errorHandlerMiddleware,
  notFoundHandler,
} from './middleware/error-handler';

import eventsRouter from './routes/events';
import registrationsRouter from './routes/registrations';
import eventLogRouter from './routes/event-log';
import exportsRouter from './routes/exports';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.server.env !== 'test') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

app.use(requestContextMiddleware);
app.use(idempotencyMiddleware);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

app.use('/api/events', eventsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/event-log', eventLogRouter);
app.use('/api/exports', exportsRouter);

app.use(notFoundHandler);
app.use(errorHandlerMiddleware);

export default app;
