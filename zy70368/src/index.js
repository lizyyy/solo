const express = require('express');
const { initMockData } = require('./models/dataStore');
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const policyRoutes = require('./routes/policyRoutes');
const auditRoutes = require('./routes/auditRoutes');
const exceptionRoutes = require('./routes/exceptionRoutes');

const app = express();
const PORT = 3000;

app.use(express.json());

const mockData = initMockData();

app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/exceptions', exceptionRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    mockData: {
      customer1Id: mockData.customer1Id,
      order1Id: mockData.order1Id,
      customerPolicyId: mockData.customerPolicyId,
      customerVersion1Id: mockData.customerVersion1Id,
      orderPolicyId: mockData.orderPolicyId,
      orderVersion1Id: mockData.orderVersion1Id
    }
  });
});

app.listen(PORT, () => {
  console.log(`接口字段脱敏 API 服务已启动`);
  console.log(`服务端口: ${PORT}`);
  console.log('');
  console.log('可用接口:');
  console.log('  - GET  /api/health                          - 健康检查（含 mock 数据 ID）');
  console.log('  - GET  /api/customers/:customerId           - 客户详情（带字段脱敏）');
  console.log('  - GET  /api/orders/:orderId                 - 订单详情（带字段脱敏）');
  console.log('  - GET  /api/policies                        - 策略列表');
  console.log('  - GET  /api/policies/:policyId              - 策略详情');
  console.log('  - GET  /api/policies/:policyId/versions     - 策略版本列表');
  console.log('  - POST /api/policies/:policyId/versions     - 创建新版本');
  console.log('  - POST /api/policies/:policyId/versions/:versionNumber/publish - 发布版本');
  console.log('  - GET  /api/policies/compare/:v1/:v2        - 对比两个版本');
  console.log('  - GET  /api/audit                           - 审计记录列表');
  console.log('  - GET  /api/audit/:logId                    - 审计记录详情');
  console.log('  - GET  /api/exceptions                      - 例外授权列表');
  console.log('  - POST /api/exceptions                      - 创建例外授权');
  console.log('');
  console.log('请求头要求:');
  console.log('  - x-user-id: 用户唯一标识');
  console.log('  - x-role:    用户角色 (customer_service | finance | outsourcing)');
  console.log('');
  console.log('Mock 数据 ID（从 /api/health 获取最新）:');
  console.log(`  - 客户 ID: ${mockData.customer1Id}`);
  console.log(`  - 订单 ID: ${mockData.order1Id}`);
  console.log(`  - 客户策略 ID: ${mockData.customerPolicyId}`);
  console.log(`  - 客户策略 v1 ID: ${mockData.customerVersion1Id}`);
});
