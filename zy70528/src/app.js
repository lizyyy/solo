const express = require('express');
const strategyRoutes = require('./routes/strategyRoutes');
const { StrategyStatus, DegradationLevel } = require('./models/constants');
const StrategyService = require('./services/strategyService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/v1/strategies', strategyRoutes);

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: '服务降级策略API运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/v1/constants', (req, res) => {
  res.json({
    success: true,
    data: {
      StrategyStatus,
      DegradationLevel
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

function initializeSampleData() {
  const sampleStrategies = [
    {
      strategyName: '高峰期用户查询降级',
      apiGroups: ['/api/user/query', '/api/user/list'],
      tenantScope: {
        type: 'include',
        tenants: ['tenant_001', 'tenant_002', 'tenant_003']
      },
      degradationLevel: DegradationLevel.L2,
      recoveryCondition: {
        type: 'threshold',
        threshold: {
          metric: 'qps',
          value: 100
        }
      },
      impactSummary: {
        description: '对高流量租户的用户查询接口进行降级'
      },
      operator: 'admin',
      remarks: '双十一高峰期间使用'
    },
    {
      strategyName: '订单创建限流',
      apiGroups: ['/api/order/create'],
      tenantScope: {
        type: 'all'
      },
      degradationLevel: DegradationLevel.L3,
      recoveryCondition: {
        type: 'manual'
      },
      impactSummary: {
        description: '对所有租户的订单创建接口进行限流'
      },
      operator: 'admin',
      remarks: '紧急降级策略'
    }
  ];

  sampleStrategies.forEach(data => {
    const strategy = StrategyService.createStrategy(data);
    StrategyService.addImpactRecord(strategy.id, {
      tenantId: 'tenant_001',
      apiPath: '/api/user/query',
      requestCount: 1500,
      impactType: 'throttled'
    });
    StrategyService.addImpactRecord(strategy.id, {
      tenantId: 'tenant_002',
      apiPath: '/api/user/list',
      requestCount: 800,
      impactType: 'degraded'
    });
  });

  console.log('示例数据初始化完成');
}

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`服务降级策略 API 已启动`);
  console.log(`运行地址: http://localhost:${PORT}`);
  console.log(`API 版本: v1`);
  console.log(`========================================\n`);
  console.log(`可用接口:`);
  console.log(`  GET  /api/v1/health - 健康检查`);
  console.log(`  GET  /api/v1/constants - 常量定义`);
  console.log(`  POST /api/v1/strategies - 创建策略`);
  console.log(`  GET  /api/v1/strategies - 查询策略列表`);
  console.log(`  GET  /api/v1/strategies/:id - 查询单个策略`);
  console.log(`  POST /api/v1/strategies/:id/publish - 发布策略`);
  console.log(`  POST /api/v1/strategies/:id/activate - 激活策略`);
  console.log(`  POST /api/v1/strategies/:id/compensate - 补偿策略`);
  console.log(`  POST /api/v1/strategies/:id/revoke - 撤销策略`);
  console.log(`  POST /api/v1/strategies/:id/manual-correct - 人工修正`);
  console.log(`  POST /api/v1/strategies/:id/failure - 记录失败路径`);
  console.log(`  POST /api/v1/strategies/:id/impact-record - 添加影响记录`);
  console.log(`  POST /api/v1/strategies/match - 策略匹配`);
  console.log(`  GET  /api/v1/strategies/export - 导出策略`);
  console.log(`  GET  /api/v1/strategies/statistics - 统计信息`);
  console.log(`\n`);

  initializeSampleData();
});

module.exports = app;
