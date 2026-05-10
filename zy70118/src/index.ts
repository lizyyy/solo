import express from 'express';
import { InMemoryBatchRepository } from './infrastructure';
import { RuleEngine } from './domain';
import { InspectionService } from './services';
import { createRouter } from './api/routes';
import {
  jsonBodyParser,
  errorHandler,
  notFoundHandler
} from './api/middleware';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

function createApp(): express.Application {
  const app = express();

  const repository = new InMemoryBatchRepository();
  const ruleEngine = new RuleEngine();
  const service = new InspectionService(repository, ruleEngine);

  app.use(jsonBodyParser);

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'food-batch-inspection-service',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/v1', createRouter(service));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`食品批次验收服务已启动，端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API基础路径: http://localhost:${PORT}/api/v1`);
  });
}

export { createApp };
