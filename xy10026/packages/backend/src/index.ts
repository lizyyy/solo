import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config from './config';
import logger from './utils/logger';
import db from './utils/db';
import redisClient from './utils/redis';
import kafkaService from './services/KafkaService';
import messagesRoute from './routes/messages';
import replayRoute from './routes/replay';
import reportsRoute from './routes/reports';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] as string || `http-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('x-trace-id', traceId);
  logger.setContext({ traceId, ip: req.ip, method: req.method, path: req.path });
  next();
});

app.use('/api/messages', messagesRoute);
app.use('/api/replay', replayRoute);
app.use('/api/reports', reportsRoute);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    dbConnected: db.getIsConnected(),
    redisConnected: redisClient.getIsConnected(),
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

async function startServer(): Promise<void> {
  try {
    logger.info('Starting Live Push System...');

    await db.connect();
    redisClient.connect();

    await kafkaService.connectProducer();
    await kafkaService.connectConsumer();

    await kafkaService.subscribe(config.kafka.topic);
    
    kafkaService.addHandler(config.kafka.topic, async (message) => {
      logger.info('Processing Kafka message', { 
        traceId: message.value.traceId,
        messageId: message.value.message.id,
      });
    });

    await kafkaService.runConsumer();

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  
  await kafkaService.disconnectAll();
  await redisClient.disconnect();
  await db.disconnect();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  
  await kafkaService.disconnectAll();
  await redisClient.disconnect();
  await db.disconnect();
  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', new Error(String(reason)));
});

startServer();
