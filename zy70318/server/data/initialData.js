import { ServiceRole, DegradeAction } from './types.js';

export const initialServices = [
  {
    id: 'gateway',
    name: 'API 网关',
    role: ServiceRole.CORE,
    description: '统一入口，路由请求',
    x: 400,
    y: 80,
  },
  {
    id: 'order-service',
    name: '下单服务',
    role: ServiceRole.CORE,
    description: '处理订单创建',
    x: 200,
    y: 200,
  },
  {
    id: 'recommend-service',
    name: '推荐服务',
    role: ServiceRole.NON_CORE,
    description: '商品推荐算法',
    x: 400,
    y: 200,
  },
  {
    id: 'member-service',
    name: '会员服务',
    role: ServiceRole.NON_CORE,
    description: '会员等级、权益',
    x: 600,
    y: 200,
  },
  {
    id: 'inventory-service',
    name: '库存服务',
    role: ServiceRole.CORE,
    description: '扣减库存',
    x: 100,
    y: 320,
  },
  {
    id: 'price-service',
    name: '价格服务',
    role: ServiceRole.NON_CORE,
    description: '计算会员价',
    x: 300,
    y: 320,
  },
  {
    id: 'benefit-service',
    name: '权益服务',
    role: ServiceRole.NON_CORE,
    description: '发放会员权益',
    x: 500,
    y: 320,
  },
];

export const initialDependencies = [
  { id: 'd1', source: 'gateway', target: 'order-service' },
  { id: 'd2', source: 'gateway', target: 'recommend-service' },
  { id: 'd3', source: 'gateway', target: 'member-service' },
  { id: 'd4', source: 'order-service', target: 'inventory-service' },
  { id: 'd5', source: 'order-service', target: 'price-service' },
  { id: 'd6', source: 'member-service', target: 'benefit-service' },
];

export const initialRules = [
  {
    id: 'rule-1',
    name: '推荐服务超时降级',
    targetService: 'recommend-service',
    action: DegradeAction.CACHE,
    enabled: true,
    priority: 1,
    description: '推荐服务超时返回本地缓存',
    conditions: {
      status: ['timeout', 'failed'],
    },
    fallbackData: {
      products: [
        { id: 101, name: '热门商品 A', price: 99 },
        { id: 102, name: '热门商品 B', price: 199 },
      ],
    },
    cacheExpireSeconds: 300,
  },
  {
    id: 'rule-2',
    name: '会员服务失败降级',
    targetService: 'member-service',
    action: DegradeAction.FALLBACK,
    enabled: true,
    priority: 1,
    description: '会员服务失败返回普通用户身份',
    conditions: {
      status: ['failed', 'timeout'],
    },
    fallbackData: {
      memberLevel: 'normal',
      discount: 1.0,
      benefits: [],
    },
  },
  {
    id: 'rule-3',
    name: '库存服务超时阻断',
    targetService: 'inventory-service',
    action: DegradeAction.BLOCK,
    enabled: true,
    priority: 1,
    description: '库存服务超时直接拒绝下单',
    conditions: {
      status: ['timeout', 'failed'],
    },
    fallbackData: null,
  },
  {
    id: 'rule-4',
    name: '价格服务超时兜底',
    targetService: 'price-service',
    action: DegradeAction.FALLBACK,
    enabled: true,
    priority: 1,
    description: '价格服务超时使用原价',
    conditions: {
      status: ['timeout'],
    },
    fallbackData: {
      finalPrice: 299,
      discountApplied: false,
    },
  },
];

export const initialDrillPlans = [
  {
    id: 'drill-1',
    name: '首页推荐演练',
    description: '模拟推荐服务超时，验证降级逻辑',
    endpoint: '/api/v1/homepage',
    method: 'GET',
    requestBody: {},
    injectedFaults: [
      {
        serviceId: 'recommend-service',
        faultType: 'timeout',
        timeoutMs: 5000,
        errorRate: 1,
      },
    ],
    status: 'idle',
  },
  {
    id: 'drill-2',
    name: '下单链路演练',
    description: '模拟库存+会员双依赖故障',
    endpoint: '/api/v1/order',
    method: 'POST',
    requestBody: {
      userId: 'user-001',
      productId: 'prod-001',
      quantity: 1,
    },
    injectedFaults: [
      {
        serviceId: 'inventory-service',
        faultType: 'timeout',
        timeoutMs: 8000,
        errorRate: 1,
      },
      {
        serviceId: 'member-service',
        faultType: 'failed',
        errorRate: 1,
      },
    ],
    status: 'idle',
  },
  {
    id: 'drill-3',
    name: '会员权益查询演练',
    description: '会员服务+权益服务级联故障',
    endpoint: '/api/v1/member/benefits',
    method: 'GET',
    requestBody: {},
    injectedFaults: [
      {
        serviceId: 'benefit-service',
        faultType: 'failed',
        errorRate: 1,
      },
    ],
    status: 'idle',
  },
];

export const cacheStore = {
  'recommend-service': {
    data: {
      products: [
        { id: 101, name: '热门商品 A', price: 99 },
        { id: 102, name: '热门商品 B', price: 199 },
      ],
    },
    timestamp: Date.now(),
    ttl: 300,
  },
};
