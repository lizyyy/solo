const store = require('../src/models/store');
const {
  createCustomer,
  createUsageMetric,
  createHealthScore,
  createTicket
} = require('../src/models/factory');
const { TICKET_PRIORITY, TICKET_SEVERITY } = require('../src/models/factory');

function createSampleData() {
  console.log('=== 开始创建样例数据 ===\n');

  const healthyCustomer = createCustomer({
    name: '创新科技有限公司',
    email: 'contact@chuangxin-tech.com',
    industry: '互联网',
    tier: 'enterprise',
    currentContract: {
      startDate: '2024-06-01',
      endDate: '2025-06-01',
      annualValue: 150000,
      productIds: ['product-core', 'product-analytics', 'product-support']
    }
  });
  store.saveCustomer(healthyCustomer);

  const healthyUsage1 = createUsageMetric({
    customerId: healthyCustomer.id,
    productId: 'product-core',
    period: 'last_30_days',
    usage: { activeUsers: 250, apiCalls: 125000, storage: '50GB' },
    trend: 'growing',
    comparedToLastPeriod: 15
  });
  store.saveUsageMetric(healthyUsage1);

  const healthyUsage2 = createUsageMetric({
    customerId: healthyCustomer.id,
    productId: 'product-analytics',
    period: 'last_30_days',
    usage: { reports: 120, dashboards: 45, alerts: 300 },
    trend: 'growing',
    comparedToLastPeriod: 8
  });
  store.saveUsageMetric(healthyUsage2);

  const healthyHealth = createHealthScore({
    customerId: healthyCustomer.id,
    score: 92,
    factors: ['高活跃度', '功能使用率高', 'NPS 评分优秀'],
    risks: []
  });
  store.saveHealthScore(healthyHealth);

  const healthyTicket1 = createTicket({
    customerId: healthyCustomer.id,
    title: '咨询新功能使用方法',
    description: '客户想了解新上线的批量导出功能如何使用',
    priority: TICKET_PRIORITY.LOW,
    severity: TICKET_SEVERITY.MINOR,
    status: 'open',
    assignee: 'support_zhang'
  });
  store.saveTicket(healthyTicket1);

  console.log('✅ 健康客户创建: 创新科技有限公司');
  console.log('   - 健康分: 92分 (excellent)');
  console.log('   - 使用趋势: 增长中');
  console.log('   - 工单: 1个低优先级咨询');

  const riskCustomer = createCustomer({
    name: '前途网络科技',
    email: 'info@qiantu-net.com',
    industry: '电商',
    tier: 'premium',
    currentContract: {
      startDate: '2024-07-15',
      endDate: '2025-07-15',
      annualValue: 80000,
      productIds: ['product-core', 'product-analytics']
    }
  });
  store.saveCustomer(riskCustomer);

  const riskUsage1 = createUsageMetric({
    customerId: riskCustomer.id,
    productId: 'product-core',
    period: 'last_30_days',
    usage: { activeUsers: 35, apiCalls: 12000, storage: '5GB' },
    trend: 'declining',
    comparedToLastPeriod: -25
  });
  store.saveUsageMetric(riskUsage1);

  const riskUsage2 = createUsageMetric({
    customerId: riskCustomer.id,
    productId: 'product-analytics',
    period: 'last_30_days',
    usage: { reports: 3, dashboards: 2, alerts: 10 },
    trend: 'declining',
    comparedToLastPeriod: -40
  });
  store.saveUsageMetric(riskUsage2);

  const riskHealth = createHealthScore({
    customerId: riskCustomer.id,
    score: 28,
    factors: ['低活跃度', '功能使用率下降'],
    risks: ['使用量持续下降', '最近30天仅1次登录', '未回复跟进邮件']
  });
  store.saveHealthScore(riskHealth);

  console.log('\n✅ 风险客户创建: 前途网络科技');
  console.log('   - 健康分: 28分 (critical)');
  console.log('   - 使用趋势: 大幅下降');
  console.log('   - 风险: 使用量持续下降、低活跃度');

  const ticketBlockedCustomer = createCustomer({
    name: '阳光制造集团',
    email: 'service@sunshine-mfg.com',
    industry: '制造业',
    tier: 'enterprise',
    currentContract: {
      startDate: '2024-05-20',
      endDate: '2025-05-20',
      annualValue: 200000,
      productIds: ['product-core', 'product-analytics', 'product-support', 'product-integration']
    }
  });
  store.saveCustomer(ticketBlockedCustomer);

  const ticketUsage1 = createUsageMetric({
    customerId: ticketBlockedCustomer.id,
    productId: 'product-core',
    period: 'last_30_days',
    usage: { activeUsers: 180, apiCalls: 85000, storage: '120GB' },
    trend: 'stable',
    comparedToLastPeriod: 2
  });
  store.saveUsageMetric(ticketUsage1);

  const ticketHealth = createHealthScore({
    customerId: ticketBlockedCustomer.id,
    score: 75,
    factors: ['稳定使用', '付费意愿明确'],
    risks: ['对响应速度有投诉']
  });
  store.saveHealthScore(ticketHealth);

  const criticalTicket = createTicket({
    customerId: ticketBlockedCustomer.id,
    title: '生产环境数据同步异常',
    description: '自上周起，生产环境与数据仓库的同步出现延迟，部分数据丢失',
    priority: TICKET_PRIORITY.CRITICAL,
    severity: TICKET_SEVERITY.SEVERE,
    status: 'open',
    assignee: 'engineer_li',
    slaBreached: true,
    createdAt: '2025-04-28T09:00:00Z',
    slaDueDate: '2025-04-28T13:00:00Z'
  });
  store.saveTicket(criticalTicket);

  const highTicket = createTicket({
    customerId: ticketBlockedCustomer.id,
    title: 'API 接口频繁超时',
    description: '近三天核心 API 接口超时率达到 15%，影响业务正常运行',
    priority: TICKET_PRIORITY.HIGH,
    severity: TICKET_SEVERITY.MAJOR,
    status: 'open',
    assignee: 'engineer_wang'
  });
  store.saveTicket(highTicket);

  console.log('\n✅ 工单阻塞客户创建: 阳光制造集团');
  console.log('   - 健康分: 75分 (good)');
  console.log('   - 工单: 2个重大未结工单 (1个已超SLA)');
  console.log('   - 状态: 续约流程不可标绿');

  const discountCustomer = createCustomer({
    name: '星辰教育科技',
    email: 'business@star-edu.com',
    industry: '教育',
    tier: 'standard',
    currentContract: {
      startDate: '2024-08-01',
      endDate: '2025-08-01',
      annualValue: 60000,
      productIds: ['product-core', 'product-support']
    }
  });
  store.saveCustomer(discountCustomer);

  const discountUsage1 = createUsageMetric({
    customerId: discountCustomer.id,
    productId: 'product-core',
    period: 'last_30_days',
    usage: { activeUsers: 120, apiCalls: 45000, storage: '25GB' },
    trend: 'stable',
    comparedToLastPeriod: 0
  });
  store.saveUsageMetric(discountUsage1);

  const discountHealth = createHealthScore({
    customerId: discountCustomer.id,
    score: 82,
    factors: ['稳定使用', '响应积极'],
    risks: ['预算紧张']
  });
  store.saveHealthScore(discountHealth);

  console.log('\n✅ 折扣审批客户创建: 星辰教育科技');
  console.log('   - 健康分: 82分 (good)');
  console.log('   - 客户级别: standard (标准折扣阈值 10%)');
  console.log('   - 场景: 需要演示折扣超阈值审批流程');

  console.log('\n=== 样例数据创建完成 ===');
  console.log('\n客户列表:');
  console.log('1. 创新科技有限公司 (健康续约场景)');
  console.log('2. 前途网络科技 (风险客户场景)');
  console.log('3. 阳光制造集团 (工单阻塞场景)');
  console.log('4. 星辰教育科技 (折扣审批场景)');
  console.log('\n运行以下命令演示各场景:');
  console.log('  npm run demo:healthy  - 健康续约流程');
  console.log('  npm run demo:risk     - 风险客户流程');
  console.log('  npm run demo:discount - 折扣审批流程');
  console.log('  npm run demo:repeat   - 重复报价/幂等演示');
}

createSampleData();
