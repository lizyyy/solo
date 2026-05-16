import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import { config } from './config';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

import batchRoutes from './routes/batch.routes';
import ruleRoutes from './routes/rule.routes';
import auditRoutes from './routes/audit.routes';
import securityRoutes from './routes/security.routes';
import demoRoutes from './routes/demo.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SLA 日志服务 API',
      version: '1.0.0',
      description: '审批流程监控与审计系统 API 文档',
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api`,
        description: '开发环境',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: process.env.USE_IN_MEMORY === 'true' ? '演示模式（内存存储）' : '完整模式（PostgreSQL）',
  });
});

app.use('/api/demo', demoRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/security', securityRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`🚀 SLA 日志服务启动成功！`);
  logger.info(`📍 服务地址: http://localhost:${config.port}`);
  logger.info(`📚 API 文档: http://localhost:${config.port}/api-docs`);
  logger.info(`💾 运行模式: ${process.env.USE_IN_MEMORY === 'true' ? '演示模式（内存存储）' : '完整模式（PostgreSQL）'}`);
  logger.info(`🧪 快速体验: POST http://localhost:${config.port}/api/demo/sample-batch 创建示例批次`);
});
