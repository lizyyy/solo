import { v4 as uuidv4 } from 'uuid';
import type {
  RateLimitRule,
  RuleVersion,
  Customer,
  RequestLog,
  DrillReport,
  ModificationLog,
  HitResult,
  Anomaly,
  Tier,
} from '../../shared/types.js';

const now = new Date('2026-05-29T10:00:00Z');
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

export const customers: Customer[] = [
  {
    id: uuidv4(),
    name: '腾讯科技',
    tier: 'S',
    priority: 1,
    isWhitelisted: true,
    whitelistExpiresAt: '2026-12-31T23:59:59Z',
    whitelistReason: '战略合作伙伴',
    totalRequests: 15420,
    blockedCount: 0,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-05-20T14:30:00Z',
  },
  {
    id: uuidv4(),
    name: '阿里巴巴',
    tier: 'S',
    priority: 2,
    isWhitelisted: true,
    whitelistExpiresAt: '2026-06-30T23:59:59Z',
    whitelistReason: '顶级客户',
    totalRequests: 12890,
    blockedCount: 0,
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-05-25T10:15:00Z',
  },
  {
    id: uuidv4(),
    name: '字节跳动',
    tier: 'A',
    priority: 3,
    isWhitelisted: true,
    whitelistExpiresAt: '2026-03-01T23:59:59Z',
    whitelistReason: '临时活动支持',
    totalRequests: 8950,
    blockedCount: 23,
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-05-28T16:45:00Z',
  },
  {
    id: uuidv4(),
    name: '美团点评',
    tier: 'A',
    priority: 4,
    isWhitelisted: false,
    totalRequests: 7620,
    blockedCount: 45,
    createdAt: '2026-02-20T11:00:00Z',
    updatedAt: '2026-05-27T09:30:00Z',
  },
  {
    id: uuidv4(),
    name: '京东集团',
    tier: 'B',
    priority: 5,
    isWhitelisted: false,
    totalRequests: 5340,
    blockedCount: 78,
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-05-26T11:20:00Z',
  },
  {
    id: uuidv4(),
    name: '拼多多',
    tier: 'B',
    priority: 6,
    isWhitelisted: false,
    totalRequests: 4890,
    blockedCount: 92,
    createdAt: '2026-03-10T13:00:00Z',
    updatedAt: '2026-05-25T14:10:00Z',
  },
  {
    id: uuidv4(),
    name: '小米科技',
    tier: 'C',
    priority: 7,
    isWhitelisted: false,
    totalRequests: 2150,
    blockedCount: 156,
    createdAt: '2026-03-20T14:00:00Z',
    updatedAt: '2026-05-24T08:50:00Z',
  },
  {
    id: uuidv4(),
    name: '网易公司',
    tier: 'C',
    priority: 8,
    isWhitelisted: false,
    totalRequests: 1870,
    blockedCount: 178,
    createdAt: '2026-04-01T15:00:00Z',
    updatedAt: '2026-05-23T13:40:00Z',
  },
];

const [customerTencent, customerAlibaba, customerBytedance, customerMeituan, customerJd, customerPdd, customerXiaomi, customerNetease] = customers;

export const whitelistEntries = [
  {
    id: uuidv4(),
    customerId: customerTencent.id,
    customerName: customerTencent.name,
    reason: '战略合作伙伴，全年白名单',
    expiresAt: '2026-12-31T23:59:59Z',
    createdBy: 'admin@example.com',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: uuidv4(),
    customerId: customerAlibaba.id,
    customerName: customerAlibaba.name,
    reason: '618大促活动临时白名单',
    expiresAt: '2026-06-30T23:59:59Z',
    createdBy: 'admin@example.com',
    createdAt: '2026-05-01T09:00:00Z',
  },
  {
    id: uuidv4(),
    customerId: customerBytedance.id,
    customerName: customerBytedance.name,
    reason: '春节活动临时白名单（已过期）',
    expiresAt: '2026-03-01T23:59:59Z',
    createdBy: 'operator@example.com',
    createdAt: '2026-02-10T10:00:00Z',
  },
];

export const rateLimitRules: RateLimitRule[] = [
  {
    id: uuidv4(),
    name: '用户信息查询限流',
    path: '/api/v1/user/info',
    method: 'GET',
    windowSize: 60,
    limit: 100,
    tier: 'B',
    status: 'active',
    currentVersion: 3,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-05-20T12:00:00Z',
  },
  {
    id: uuidv4(),
    name: '订单创建限流',
    path: '/api/v1/order/create',
    method: 'POST',
    windowSize: 60,
    limit: 100,
    tier: 'A',
    status: 'active',
    currentVersion: 2,
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-05-15T10:00:00Z',
  },
  {
    id: uuidv4(),
    name: '支付接口限流',
    path: '/api/v1/payment/*',
    method: '*',
    windowSize: 60,
    limit: 100,
    tier: 'S',
    status: 'active',
    currentVersion: 1,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: uuidv4(),
    name: '商品列表查询限流',
    path: '/api/v1/products',
    method: 'GET',
    windowSize: 60,
    limit: 100,
    tier: 'C',
    status: 'draft',
    currentVersion: 1,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  },
];

const [ruleUserInfo, ruleOrderCreate, rulePayment, ruleProducts] = rateLimitRules;

export const ruleVersions: RuleVersion[] = [
  {
    id: uuidv4(),
    ruleId: ruleUserInfo.id,
    version: 1,
    snapshot: { ...ruleUserInfo, currentVersion: 1, limit: 50, updatedAt: '2026-03-01T00:00:00Z' },
    changeReason: '初始版本创建',
    modifiedBy: 'admin@example.com',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: uuidv4(),
    ruleId: ruleUserInfo.id,
    version: 2,
    snapshot: { ...ruleUserInfo, currentVersion: 2, limit: 80, updatedAt: '2026-04-10T08:00:00Z' },
    changeReason: '根据业务增长调整阈值',
    modifiedBy: 'architect@example.com',
    createdAt: '2026-04-10T08:00:00Z',
  },
  {
    id: uuidv4(),
    ruleId: ruleUserInfo.id,
    version: 3,
    snapshot: { ...ruleUserInfo, currentVersion: 3, limit: 100, updatedAt: '2026-05-20T12:00:00Z' },
    changeReason: '618大促前进一步放宽限制',
    modifiedBy: 'admin@example.com',
    createdAt: '2026-05-20T12:00:00Z',
  },
  {
    id: uuidv4(),
    ruleId: ruleOrderCreate.id,
    version: 1,
    snapshot: { ...ruleOrderCreate, currentVersion: 1, limit: 60, updatedAt: '2026-03-15T00:00:00Z' },
    changeReason: '初始版本创建',
    modifiedBy: 'admin@example.com',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: uuidv4(),
    ruleId: ruleOrderCreate.id,
    version: 2,
    snapshot: { ...ruleOrderCreate, currentVersion: 2, limit: 100, updatedAt: '2026-05-15T10:00:00Z' },
    changeReason: '订单量增加，调整阈值',
    modifiedBy: 'operator@example.com',
    createdAt: '2026-05-15T10:00:00Z',
  },
];

const paths = [
  '/api/v1/user/info',
  '/api/v1/order/create',
  '/api/v1/payment/submit',
  '/api/v1/payment/callback',
  '/api/v1/products',
  '/api/v1/user/profile',
  '/api/v1/order/list',
];

const methods = ['GET', 'POST', 'PUT', 'DELETE'];
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Android 13; Mobile) AppleWebKit/537.36',
  'okhttp/4.9.0',
];

const ips = [
  '192.168.1.100',
  '10.0.0.50',
  '172.16.0.25',
  '203.0.113.45',
  '198.51.100.23',
];

function generateRequestLogs(): RequestLog[] {
  const logs: RequestLog[] = [];
  const customerList = [customerTencent, customerAlibaba, customerBytedance, customerMeituan, customerJd, customerPdd, customerXiaomi, customerNetease];
  const highTrafficCustomer = customerPdd;
  const highTrafficPath = '/api/v1/user/info';

  const burstStartTime = new Date(now.getTime() - 3600000);

  for (let i = 0; i < 120; i++) {
    const burstTime = new Date(burstStartTime.getTime() + i * 200);
    logs.push({
      id: uuidv4(),
      customerId: highTrafficCustomer.id,
      path: highTrafficPath,
      method: 'GET',
      timestamp: burstTime.toISOString(),
      statusCode: 200,
      latency: Math.floor(Math.random() * 100) + 10,
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      ip: ips[Math.floor(Math.random() * ips.length)],
    });
  }

  for (let i = 0; i < 80; i++) {
    const randomMinutes = Math.floor(Math.random() * 7 * 24 * 60);
    const timestamp = new Date(sevenDaysAgo.getTime() + randomMinutes * 60 * 1000);
    const customer = customerList[Math.floor(Math.random() * customerList.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    const method = methods[Math.floor(Math.random() * methods.length)];

    logs.push({
      id: uuidv4(),
      customerId: customer.id,
      path,
      method,
      timestamp: timestamp.toISOString(),
      statusCode: Math.random() > 0.9 ? 429 : (Math.random() > 0.8 ? 500 : 200),
      latency: Math.floor(Math.random() * 300) + 20,
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      ip: ips[Math.floor(Math.random() * ips.length)],
    });
  }

  return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export const requestLogs: RequestLog[] = generateRequestLogs();

function generateHitResults(rule: RateLimitRule, customer: Customer, count: number, reason: HitResult['hitReason']): HitResult[] {
  const results: HitResult[] = [];
  const baseTime = new Date(now.getTime() - 86400000);

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime.getTime() + i * 500);
    results.push({
      id: uuidv4(),
      requestId: uuidv4(),
      ruleId: rule.id,
      ruleVersion: rule.currentVersion,
      customerId: customer.id,
      customerName: customer.name,
      customerTier: customer.tier,
      hitReason: reason,
      explanation: reason === 'threshold_exceeded'
        ? `60秒内请求超过${rule.limit}次阈值`
        : reason === 'whitelist_expired'
        ? '客户白名单已过期'
        : reason === 'window_overlap'
        ? '时间窗口计算重叠导致误判'
        : '疑似正常流量被误杀',
      wouldBlock: reason !== 'false_positive',
      confidence: reason === 'threshold_exceeded' ? 0.95 : reason === 'false_positive' ? 0.65 : 0.85,
      requestTimestamp: timestamp.toISOString(),
      requestPath: rule.path,
    });
  }
  return results;
}

function generateAnomalies(): Anomaly[] {
  return [
    {
      id: uuidv4(),
      type: 'whitelist_expired',
      severity: 'critical',
      message: `客户「${customerBytedance.name}」的白名单已过期，当前已被限流拦截`,
      affectedEntities: [customerBytedance.id],
      recommendation: '请评估是否需要续期该客户的白名单',
      resolved: false,
      createdAt: '2026-03-02T00:00:00Z',
    },
    {
      id: uuidv4(),
      type: 'window_overlap',
      severity: 'warning',
      message: '规则「用户信息查询限流」存在时间窗口重叠问题，可能导致统计不准确',
      affectedEntities: [ruleUserInfo.id],
      recommendation: '建议检查滑动窗口实现逻辑，避免边界重叠',
      resolved: false,
      createdAt: '2026-05-25T14:30:00Z',
    },
    {
      id: uuidv4(),
      type: 'false_positive',
      severity: 'warning',
      message: '演练中发现疑似误杀情况，正常业务流量被错误拦截',
      affectedEntities: [customerJd.id, ruleOrderCreate.id],
      recommendation: '建议复核该场景的限流阈值和判定逻辑',
      resolved: true,
      resolution: '已调整限流阈值从60次/分钟提升至100次/分钟',
      createdAt: '2026-05-10T09:15:00Z',
    },
  ];
}

const anomalies = generateAnomalies();

export const drillReports: DrillReport[] = [
  {
    id: uuidv4(),
    name: '用户信息查询接口限流演练',
    ruleId: ruleUserInfo.id,
    ruleName: ruleUserInfo.name,
    ruleVersion: ruleUserInfo.currentVersion,
    startTime: '2026-05-28T00:00:00Z',
    endTime: '2026-05-28T23:59:59Z',
    sampleRate: 1.0,
    totalRequests: 1250,
    hitCount: 45,
    blockedCustomers: [customerPdd.id, customerXiaomi.id],
    anomalies: [anomalies[1]],
    hitResults: [
      ...generateHitResults(ruleUserInfo, customerPdd, 25, 'threshold_exceeded'),
      ...generateHitResults(ruleUserInfo, customerXiaomi, 15, 'threshold_exceeded'),
      ...generateHitResults(ruleUserInfo, customerJd, 5, 'false_positive'),
    ],
    conclusion: '限流规则正常工作，但发现少量疑似误杀情况，建议进一步优化阈值。',
    status: 'completed',
    createdAt: '2026-05-28T08:00:00Z',
  },
  {
    id: uuidv4(),
    name: '订单创建接口618预演',
    ruleId: ruleOrderCreate.id,
    ruleName: ruleOrderCreate.name,
    ruleVersion: ruleOrderCreate.currentVersion,
    startTime: '2026-05-27T00:00:00Z',
    endTime: '2026-05-27T23:59:59Z',
    sampleRate: 0.8,
    totalRequests: 890,
    hitCount: 28,
    blockedCustomers: [customerJd.id],
    anomalies: [anomalies[2]],
    hitResults: [
      ...generateHitResults(ruleOrderCreate, customerJd, 20, 'threshold_exceeded'),
      ...generateHitResults(ruleOrderCreate, customerMeituan, 8, 'false_positive'),
    ],
    conclusion: '618预演发现部分客户阈值偏低，已完成调整。',
    status: 'completed',
    createdAt: '2026-05-27T08:00:00Z',
  },
  {
    id: uuidv4(),
    name: '支付接口全量演练',
    ruleId: rulePayment.id,
    ruleName: rulePayment.name,
    ruleVersion: rulePayment.currentVersion,
    startTime: '2026-05-26T00:00:00Z',
    endTime: '2026-05-26T23:59:59Z',
    sampleRate: 1.0,
    totalRequests: 2100,
    hitCount: 12,
    blockedCustomers: [customerBytedance.id],
    anomalies: [anomalies[0]],
    hitResults: [
      ...generateHitResults(rulePayment, customerBytedance, 12, 'whitelist_expired'),
    ],
    conclusion: '发现字节跳动白名单已过期，需人工确认是否续期。',
    status: 'completed',
    createdAt: '2026-05-26T08:00:00Z',
  },
];

export const modificationLogs: ModificationLog[] = [
  {
    id: uuidv4(),
    entityType: 'rule',
    entityId: ruleUserInfo.id,
    field: 'limit',
    oldValue: '50',
    newValue: '80',
    reason: '根据业务增长调整阈值',
    modifiedBy: 'architect@example.com',
    createdAt: '2026-04-10T08:00:00Z',
  },
  {
    id: uuidv4(),
    entityType: 'rule',
    entityId: ruleUserInfo.id,
    field: 'limit',
    oldValue: '80',
    newValue: '100',
    reason: '618大促前进一步放宽限制',
    modifiedBy: 'admin@example.com',
    createdAt: '2026-05-20T12:00:00Z',
  },
  {
    id: uuidv4(),
    entityType: 'rule',
    entityId: ruleOrderCreate.id,
    field: 'limit',
    oldValue: '60',
    newValue: '100',
    reason: '订单量增加，调整阈值',
    modifiedBy: 'operator@example.com',
    createdAt: '2026-05-15T10:00:00Z',
  },
  {
    id: uuidv4(),
    entityType: 'customer',
    entityId: customerBytedance.id,
    field: 'tier',
    oldValue: 'S',
    newValue: 'A',
    reason: '客户合同调整，降级处理',
    modifiedBy: 'admin@example.com',
    createdAt: '2026-03-15T14:00:00Z',
  },
  {
    id: uuidv4(),
    entityType: 'customer',
    entityId: customerMeituan.id,
    field: 'isWhitelisted',
    oldValue: 'true',
    newValue: 'false',
    reason: '白名单到期，未续期',
    modifiedBy: 'operator@example.com',
    createdAt: '2026-04-01T09:30:00Z',
  },
  {
    id: uuidv4(),
    entityType: 'whitelist',
    entityId: whitelistEntries[1].id,
    field: 'expiresAt',
    oldValue: '2026-05-31T23:59:59Z',
    newValue: '2026-06-30T23:59:59Z',
    reason: '618大促延长白名单有效期',
    modifiedBy: 'admin@example.com',
    createdAt: '2026-05-20T16:00:00Z',
  },
  {
    id: uuidv4(),
    entityType: 'rule',
    entityId: ruleProducts.id,
    field: 'status',
    oldValue: 'draft',
    newValue: 'active',
    reason: '规则审批通过，正式启用',
    modifiedBy: 'admin@example.com',
    createdAt: '2026-05-25T11:00:00Z',
  },
  {
    id: uuidv4(),
    entityType: 'customer',
    entityId: customerTencent.id,
    field: 'priority',
    oldValue: '2',
    newValue: '1',
    reason: '战略客户优先级提升',
    modifiedBy: 'admin@example.com',
    createdAt: '2026-05-10T10:00:00Z',
  },
];
