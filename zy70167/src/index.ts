import express from 'express';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

import './database/init';

import ruleVersionsRouter from './routes/ruleVersions';
import batchesRouter from './routes/batches';
import subscriptionsRouter from './routes/subscriptions';
import waivesRouter from './routes/waives';
import reportsRouter from './routes/reports';
import logsRouter from './routes/logs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'data-quality-rule-api',
      version: '1.0.0',
    },
  });
});

app.use('/api/rule-versions', ruleVersionsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/waives', waivesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/logs', logsRouter);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      service: '数据质量规则发布 API',
      version: '1.0.0',
      endpoints: {
        '规则版本管理': '/api/rule-versions',
        '批次重算': '/api/batches',
        '告警订阅': '/api/subscriptions',
        '误报豁免': '/api/waives',
        '质量报表': '/api/reports',
        '操作日志': '/api/logs',
      },
      documentation: '参见 API 文档了解详细用法',
    },
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路径不存在: ${req.originalUrl}`,
    },
  });
});

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
);

app.listen(PORT, () => {
  console.log(`数据质量规则发布 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 入口: http://localhost:${PORT}/api`);
});
