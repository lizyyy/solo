import express from 'express';
import { configService } from './services/configService';
import apiRoutes from './routes/api';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/errorHandler';

const app = express();
const appConfig = configService.getAppConfig();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);

app.get('/', (req, res) => {
  res.json({
    service: 'Order Sharding Router API',
    version: '1.0.0',
    description: '支持订单数据分库分表路由、迁移管理和查询计划的 API 服务',
    endpoints: {
      health: 'GET /api/health',
      writeRoute: 'POST /api/route/write',
      queryRoute: 'POST /api/route/query',
      explainRoute: 'POST /api/route/explain',
      queryPlan: 'POST /api/query/plan',
      compensationCreate: 'POST /api/compensation/create',
      compensationProcess: 'POST /api/compensation/process',
      pendingCompensations: 'GET /api/compensation/pending/:tenantId',
      dualReadResolve: 'POST /api/dualread/resolve',
      tenantConfig: 'GET /api/config/tenant/:tenantId',
      shards: 'GET /api/config/shards',
      audit: 'GET /api/audit/recent',
    },
  });
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = appConfig.port;

app.listen(PORT, () => {
  console.log(`Order Sharding Router API 服务已启动`);
  console.log(`端口: ${PORT}`);
  console.log(`环境: ${appConfig.environment}`);
  console.log(`基础地址: http://localhost:${PORT}`);
  console.log('');
  console.log('可用端点:');
  console.log('  GET  /api/health                           - 健康检查');
  console.log('  POST /api/route/write                      - 写入路由');
  console.log('  POST /api/route/query                      - 查询路由');
  console.log('  POST /api/route/explain                    - 路由解释');
  console.log('  POST /api/query/plan                       - 跨月查询计划');
  console.log('  POST /api/compensation/create              - 创建补偿请求');
  console.log('  POST /api/compensation/process             - 处理补偿');
  console.log('  GET  /api/compensation/pending/:tenantId   - 查看待处理补偿');
  console.log('  POST /api/dualread/resolve                 - 双读冲突解决');
  console.log('  GET  /api/config/tenant/:tenantId          - 租户配置');
  console.log('  GET  /api/config/shards                    - 分片列表');
  console.log('  GET  /api/audit/recent                     - 审计记录');
});
