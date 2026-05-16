const sampleSpace = {
  namespace: 'sandbox_payment_2024_q1',
  name: '支付系统Q1复盘沙箱',
  description: '用于2024年Q1支付系统故障事件回放的隔离环境，禁止写入生产数据',
  createdBy: 'engineer_zhang',
  config: {
    environment: 'sandbox',
    readOnly: false,
    maxBatchSize: 1000,
    allowedTargets: ['sandbox-db', 'test-kafka'],
    blockedTargets: ['prod-db', 'prod-kafka', 'prod-redis']
  }
};

const sampleBatch = {
  batchName: '2024-01-15_支付超时事件',
  sourceSystem: 'payment-gateway',
  createdBy: 'engineer_zhang',
  description: '1月15日14:30-15:45期间的支付超时失败事件，共计2347条原始日志'
};

const samplePayloads = [
  {
    originalEventId: 'pay_20240115_0001',
    eventType: 'payment_timeout',
    originalPayload: {
      orderId: 'ORD-20240115-143056',
      userId: 'U8923471',
      phone: '13812345678',
      email: 'user@example.com',
      idCard: '110101199001011234',
      amount: 299.00,
      channel: 'alipay',
      ip: '192.168.1.100',
      address: '北京市朝阳区建国路88号SOHO现代城',
      createTime: '2024-01-15T14:30:56.123Z',
      expireTime: '2024-01-15T14:45:56.123Z',
      status: 'TIMEOUT'
    },
    desensitizedBy: 'engineer_zhang',
    autoDesensitize: true
  },
  {
    originalEventId: 'pay_20240115_0002',
    eventType: 'payment_failed',
    originalPayload: {
      orderId: 'ORD-20240115-143122',
      userId: 'U7654321',
      phone: '13987654321',
      email: 'test@company.com',
      idCard: '310101199102025678',
      amount: 1599.00,
      channel: 'wechat',
      ip: '10.0.0.55',
      address: '上海市浦东新区陆家嘴金融中心88层',
      createTime: '2024-01-15T14:31:22.456Z',
      errorCode: 'INSUFFICIENT_BALANCE',
      errorMessage: '账户余额不足',
      status: 'FAILED'
    },
    desensitizedBy: 'engineer_zhang',
    autoDesensitize: true
  },
  {
    originalEventId: 'pay_20240115_0003',
    eventType: 'system_error',
    originalPayload: {
      orderId: 'ORD-20240115-143208',
      userId: 'U1234567',
      phone: '13700138000',
      email: 'admin@test.org',
      idCard: '440101198903039012',
      amount: 88.88,
      channel: 'unionpay',
      ip: '172.16.0.10',
      address: '广州市天河区珠江新城华夏路30号',
      createTime: '2024-01-15T14:32:08.789Z',
      errorCode: 'SYSTEM_MAINTENANCE',
      errorMessage: '系统维护中，请稍后重试',
      status: 'ERROR'
    },
    desensitizedBy: 'engineer_zhang',
    autoDesensitize: true
  }
];

const sampleException = {
  exceptionType: 'deserialization_error',
  errorMessage: '无法解析JSON格式，字段 amount 类型不匹配',
  errorStack: 'Error: Invalid type at position 123\n    at Parser.parse (/app/parser.js:45)\n    at EventProcessor.process (/app/processor.js:22)',
  originalInput: {
    rawData: '{"orderId":"ORD-XXX","amount":"not_a_number","userId":"U123"}',
    source: 'kafka_topic_payment_events',
    partition: 3,
    offset: 89234
  },
  processingEvidence: {
    schemaVersion: 'v2.1',
    validationRules: ['amount_must_be_numeric'],
    attemptedFixes: ['type_coercion', 'default_value']
  },
  operatedBy: 'system'
};

const sampleCorrection = {
  correctionType: 'payload_value_correction',
  originalValue: {
    amount: 'not_a_number',
    status: 'UNKNOWN'
  },
  correctedValue: {
    amount: 0,
    status: 'INVALID'
  },
  correctionReason: '原始数据格式错误，amount字段非数字类型，人工修正为0，状态标记为INVALID',
  correctedBy: 'engineer_li'
};

const sampleReview = {
  summaryTitle: '2024年1月15日支付系统超时故障复盘报告',
  summaryContent: '本次故障发生于14:30-15:45，持续约75分钟，影响支付订单约2347笔。主要原因是第三方支付渠道网络波动，同时我方熔断机制阈值设置过高，未能及时触发降级处理。',
  rootCause: '1. 第三方支付渠道网络延迟超过阈值；2. 系统熔断保护阈值设置为5000ms过高；3. 降级方案未自动触发，需要人工干预。',
  impactAssessment: '影响用户数约1800人，资金安全无风险，所有超时订单后续通过对账系统完成处理，用户体验受损。',
  correctiveActions: [
    { action: '降低熔断阈值至2000ms', owner: 'team_sre', deadline: '2024-01-20', status: 'pending' },
    { action: '优化降级方案自动触发逻辑', owner: 'team_dev', deadline: '2024-01-22', status: 'pending' },
    { action: '增加第三方渠道监控告警', owner: 'team_monitor', deadline: '2024-01-18', status: 'pending' },
    { action: '更新用户端超时提示文案', owner: 'team_product', deadline: '2024-01-19', status: 'pending' }
  ],
  createdBy: 'manager_wang'
};

module.exports = {
  sampleSpace,
  sampleBatch,
  samplePayloads,
  sampleException,
  sampleCorrection,
  sampleReview
};
