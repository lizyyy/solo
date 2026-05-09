import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { PoolService, PoolServiceConfig, PoolServiceOptions } from './core/pool-service';
import { createEnvConfig } from './config';
import { logger } from './utils/logger';

const envConfig = createEnvConfig();

const app = express();
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

const defaultPoolConfig: PoolServiceConfig = {
  pool: {
    name: 'default-pool',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    },
    min: parseInt(process.env.POOL_MIN || '2', 10),
    max: parseInt(process.env.POOL_MAX || '10', 10),
    acquireTimeout: parseInt(process.env.POOL_ACQUIRE_TIMEOUT || '30000', 10),
    idleTimeout: parseInt(process.env.POOL_IDLE_TIMEOUT || '60000', 10),
    reapInterval: parseInt(process.env.POOL_REAP_INTERVAL || '30000', 10),
    testOnBorrow: process.env.POOL_TEST_ON_BORROW !== 'false',
    testOnReturn: process.env.POOL_TEST_ON_RETURN === 'true',
    testWhileIdle: process.env.POOL_TEST_WHILE_IDLE !== 'false'
  },
  cacheStrategy: 'read-through',
  replay: {
    maxRecords: parseInt(process.env.REPLAY_MAX_RECORDS || '10000', 10),
    retentionPeriod: parseInt(process.env.REPLAY_RETENTION || '86400000', 10),
    storagePath: process.env.REPLAY_PATH || './data/events',
    autoPersist: process.env.REPLAY_AUTO_PERSIST !== 'false'
  }
};

const serviceOptions: PoolServiceOptions = {
  enableEvents: process.env.ENABLE_EVENTS !== 'false',
  enableCache: process.env.ENABLE_CACHE !== 'false',
  enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
  enableRetry: process.env.ENABLE_RETRY !== 'false',
  enableIdempotency: process.env.ENABLE_IDEMPOTENCY !== 'false'
};

let poolService: PoolService;

app.get('/health', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ status: 'initializing' });
  }

  const health = poolService.healthCheck();
  return res.json({
    status: health.healthy ? 'healthy' : 'unhealthy',
    ...health
  });
});

app.get('/api/metrics', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const metrics = poolService.getMetrics();
  return res.json(metrics);
});

app.get('/api/status', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const stats = poolService.getServiceStats();
  return res.json(stats);
});

app.get('/api/connections', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const connections = poolService.getConnectionInfos();
  return res.json({
    total: connections.length,
    connections
  });
});

app.get('/api/connections/:id', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const connection = poolService.getConnectionById(req.params.id);
  if (!connection) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  return res.json(connection);
});

app.get('/api/events', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const startTime = req.query.startTime ? parseInt(req.query.startTime as string, 10) : undefined;
  const endTime = req.query.endTime ? parseInt(req.query.endTime as string, 10) : undefined;
  const types = req.query.types ? (req.query.types as string).split(',') : undefined;
  const levels = req.query.levels 
    ? (req.query.levels as string).split(',') as any
    : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  const events = poolService.getEvents({ startTime, endTime, types, levels, limit });
  return res.json({
    total: events.length,
    events
  });
});

app.get('/api/events/:id', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const event = poolService.getEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  return res.json(event);
});

app.post('/api/execute', async (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  try {
    const { query, params, idempotencyKey, requestId, timeout, retries } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await poolService.execute(
      async (conn) => {
        const connection = await conn;
        return connection.query(query, params);
      },
      {
        requestId,
        idempotencyKey,
        timeout: timeout ? parseInt(timeout, 10) : undefined,
        retries: retries ? parseInt(retries, 10) : undefined
      }
    );

    return res.json({ success: true, result });
  } catch (error) {
    logger.error('API execute error', error as Error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

app.post('/api/cache/invalidate', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const { key, pattern } = req.body;

  if (pattern) {
    const count = poolService.invalidateCachePattern(pattern);
    return res.json({ success: true, invalidated: count, pattern });
  }

  if (key) {
    const success = poolService.invalidateCache(key);
    return res.json({ success, key });
  }

  return res.status(400).json({ error: 'key or pattern is required' });
});

app.post('/api/circuit-breaker/reset', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  poolService.resetCircuitBreaker();
  return res.json({ success: true, message: 'Circuit breaker reset' });
});

app.post('/api/idempotency/clear', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  poolService.clearIdempotencyCache();
  return res.json({ success: true, message: 'Idempotency cache cleared' });
});

app.get('/api/report', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const startTime = req.query.startTime ? parseInt(req.query.startTime as string, 10) : undefined;
  const endTime = req.query.endTime ? parseInt(req.query.endTime as string, 10) : undefined;
  const title = req.query.title as string;
  const includeEvents = req.query.includeEvents !== 'false';
  const maxEvents = req.query.maxEvents ? parseInt(req.query.maxEvents as string, 10) : undefined;

  const report = poolService.generateReport({
    period: startTime && endTime ? { start: startTime, end: endTime } : undefined,
    title,
    includeEvents,
    maxEvents
  });

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="pool-report-${Date.now()}.md"`);
  return res.send(report);
});

app.post('/api/report/save', async (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  try {
    const { filePath, startTime, endTime, title, includeEvents, maxEvents } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    await poolService.saveReport(filePath, {
      period: startTime && endTime ? { start: startTime, end: endTime } : undefined,
      title,
      includeEvents,
      maxEvents
    });

    return res.json({ success: true, filePath });
  } catch (error) {
    logger.error('API save report error', error as Error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

app.get('/api/config', (req, res) => {
  if (!poolService) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const config = poolService.getConfig();
  const safeConfig = {
    ...config,
    pool: {
      ...config.pool,
      connection: {
        ...config.pool.connection,
        password: '********'
      }
    }
  };

  return res.json(safeConfig);
});

async function startServer() {
  try {
    logger.info('Starting pool service...');
    poolService = new PoolService(defaultPoolConfig, serviceOptions);
    await poolService.initialize();

    const server = app.listen(envConfig.port, envConfig.host, () => {
      logger.info(`Server running on http://${envConfig.host}:${envConfig.port}`);
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        if (poolService) {
          await poolService.close();
        }
        logger.info('Server shutdown complete');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Force shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

startServer();
