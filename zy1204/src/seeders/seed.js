require('dotenv').config();
const { Policy, TrafficTrace, Experiment, syncDatabase } = require('../models');
const fs = require('fs');
const path = require('path');

async function seed() {
  console.log('开始填充数据库...');
  
  await syncDatabase(true);
  
  const policies = await createPolicies();
  console.log('策略创建完成');
  
  const traces = await createTrafficTraces();
  console.log('流量追踪创建完成');
  
  await createExperiments(policies, traces);
  console.log('实验创建完成');
  
  console.log('数据库填充完成！');
}

async function createPolicies() {
  const policiesData = [
    {
      name: '令牌桶限流策略',
      description: '标准令牌桶限流，容量100，速率10/s',
      type: 'rate_limit',
      rateLimitType: 'token_bucket',
      config: {
        capacity: 100,
        rate: 10,
        initialTokens: 100,
        queueEnabled: true,
        maxQueueSize: 50
      },
      isActive: true
    },
    {
      name: '漏桶限流策略',
      description: '漏桶限流，容量100，速率5/s，平滑流量',
      type: 'rate_limit',
      rateLimitType: 'leaky_bucket',
      config: {
        capacity: 100,
        rate: 5,
        queueEnabled: true,
        maxQueueSize: 50
      },
      isActive: true
    },
    {
      name: '滑动窗口限流策略',
      description: '60秒窗口内最多100个请求',
      type: 'rate_limit',
      rateLimitType: 'sliding_window',
      config: {
        windowSize: 60,
        maxRequests: 100,
        queueEnabled: false,
        maxQueueSize: 0
      },
      isActive: true
    },
    {
      name: '用户服务熔断器',
      description: '用户服务的熔断保护，失败阈值50%',
      type: 'circuit_breaker',
      rateLimitType: null,
      config: {
        failureThreshold: 0.5,
        minimumRequests: 10,
        halfOpenRequestLimit: 3,
        resetTimeout: 60000,
        fallbackEnabled: true
      },
      isActive: true
    },
    {
      name: '订单服务熔断器',
      description: '订单服务的熔断保护，失败阈值30%',
      type: 'circuit_breaker',
      rateLimitType: null,
      config: {
        failureThreshold: 0.3,
        minimumRequests: 5,
        halfOpenRequestLimit: 5,
        resetTimeout: 30000,
        fallbackEnabled: true
      },
      isActive: true
    },
    {
      name: 'API网关过载保护',
      description: '最大并发100，支持自适应调整',
      type: 'overload_protection',
      rateLimitType: null,
      config: {
        maxConcurrency: 100,
        maxQueueSize: 50,
        queueTimeout: 5000,
        fallbackEnabled: true,
        adaptiveEnabled: true,
        minConcurrency: 10,
        targetLatency: 500
      },
      isActive: true
    },
    {
      name: '严格限流策略',
      description: '严格限流，容量10，速率1/s，无队列',
      type: 'rate_limit',
      rateLimitType: 'token_bucket',
      config: {
        capacity: 10,
        rate: 1,
        initialTokens: 10,
        queueEnabled: false,
        maxQueueSize: 0
      },
      isActive: true
    }
  ];
  
  const policies = [];
  for (const data of policiesData) {
    const policy = await Policy.create(data);
    policies.push(policy);
  }
  
  return policies;
}

function generateTrafficData(pattern = 'normal', count = 50) {
  const requests = [];
  const endpoints = [
    '/api/users', '/api/users/1', '/api/users/2',
    '/api/orders', '/api/orders/101',
    '/api/products', '/api/products/search',
    '/api/payments', '/api/auth/login'
  ];
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  
  for (let i = 0; i < count; i++) {
    let latency;
    let statusCode = 200;
    
    switch (pattern) {
      case 'burst':
        latency = Math.random() * 50 + 10;
        if (i < 30) {
          statusCode = 200;
        } else if (i < 40) {
          latency = Math.random() * 200 + 100;
          statusCode = 200;
        } else {
          statusCode = 429;
          latency = 10;
        }
        break;
        
      case 'error-prone':
        latency = Math.random() * 200 + 50;
        if (Math.random() < 0.4) {
          statusCode = 500;
        } else if (Math.random() < 0.2) {
          statusCode = 404;
        }
        break;
        
      case 'slow':
        latency = Math.random() * 500 + 300;
        statusCode = 200;
        break;
        
      default:
        latency = Math.random() * 100 + 20;
        if (Math.random() < 0.05) {
          statusCode = 500;
        }
    }
    
    const method = methods[Math.floor(Math.random() * methods.length)];
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    
    requests.push({
      requestId: `req_${Date.now()}_${i.toString().padStart(4, '0')}`,
      timestamp: new Date(Date.now() - (count - i) * 1000),
      url: endpoint,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: method === 'POST' || method === 'PUT' ? { data: 'test' } : null,
      query: method === 'GET' ? { page: 1, limit: 10 } : {},
      latency: Math.round(latency),
      responseInfo: {
        statusCode,
        body: statusCode === 200 ? { success: true } : { error: 'Something went wrong' }
      }
    });
  }
  
  return requests;
}

async function createTrafficTraces() {
  const tracesData = [
    {
      name: '正常流量样本',
      description: '正常业务流量，包含各种API调用',
      source: 'seed',
      data: generateTrafficData('normal', 50)
    },
    {
      name: '突发流量样本',
      description: '模拟高并发突发流量场景',
      source: 'seed',
      data: generateTrafficData('burst', 60)
    },
    {
      name: '高错误率流量',
      description: '模拟下游服务故障，高错误率场景',
      source: 'seed',
      data: generateTrafficData('error-prone', 40)
    },
    {
      name: '慢响应流量',
      description: '模拟下游服务响应缓慢的场景',
      source: 'seed',
      data: generateTrafficData('slow', 30)
    },
    {
      name: '混合复杂场景',
      description: '包含正常、错误、慢响应的混合场景',
      source: 'seed',
      data: [
        ...generateTrafficData('normal', 20),
        ...generateTrafficData('error-prone', 15),
        ...generateTrafficData('slow', 10)
      ]
    }
  ];
  
  const traces = [];
  for (const data of tracesData) {
    const trace = await TrafficTrace.create({
      ...data,
      requestCount: data.data.length
    });
    traces.push(trace);
  }
  
  return traces;
}

async function createExperiments(policies, traces) {
  if (policies.length === 0 || traces.length === 0) return;
  
  const experimentsData = [
    {
      name: '令牌桶限流实验',
      description: '测试令牌桶限流策略在正常流量下的表现',
      status: 'draft',
      config: {
        policyIds: [policies[0]?.id],
        trafficTraceId: traces[0]?.id
      }
    },
    {
      name: '混合策略实验',
      description: '组合使用限流、熔断和过载保护',
      status: 'draft',
      config: {
        policyIds: [policies[0]?.id, policies[3]?.id, policies[5]?.id],
        trafficTraceId: traces[1]?.id
      }
    },
    {
      name: '熔断策略测试',
      description: '在高错误率流量下测试熔断器',
      status: 'draft',
      config: {
        policyIds: [policies[3]?.id],
        trafficTraceId: traces[2]?.id
      }
    }
  ];
  
  for (const data of experimentsData) {
    await Experiment.create(data);
  }
}

const badPolicies = {
  tooTightTokenBucket: {
    name: '过严格的令牌桶',
    description: '桶容量和速率设置过小，几乎所有请求都会被拒绝',
    type: 'rate_limit',
    rateLimitType: 'token_bucket',
    config: {
      capacity: 1,
      rate: 0.1,
      initialTokens: 1,
      queueEnabled: false,
      maxQueueSize: 0
    },
    isActive: false,
    problem: '桶容量和速率设置过小，无法处理正常流量'
  },
  
  negativeRateLimit: {
    name: '负数值限流',
    description: '配置了无效的负数值',
    type: 'rate_limit',
    rateLimitType: 'sliding_window',
    config: {
      windowSize: -60,
      maxRequests: -100,
      queueEnabled: true,
      maxQueueSize: -50
    },
    isActive: false,
    problem: '时间窗口和最大请求数不能为负数'
  },
  
  impossibleCircuitBreaker: {
    name: '不可能的熔断器',
    description: '失败阈值超过100%，永远无法打开',
    type: 'circuit_breaker',
    config: {
      failureThreshold: 1.5,
      minimumRequests: 0,
      halfOpenRequestLimit: -1,
      resetTimeout: -60000,
      fallbackEnabled: true
    },
    isActive: false,
    problem: '失败阈值应在0-1之间，超时时间不能为负'
  },
  
  zeroConcurrency: {
    name: '零并发限制',
    description: '最大并发设为0，所有请求都会被拒绝',
    type: 'overload_protection',
    config: {
      maxConcurrency: 0,
      maxQueueSize: 0,
      queueTimeout: 0,
      fallbackEnabled: false
    },
    isActive: false,
    problem: '最大并发数不能为0，队列超时不能为0'
  },
  
  contradictoryFallback: {
    name: '矛盾的降级配置',
    description: '启用降级但没有任何降级策略',
    type: 'circuit_breaker',
    config: {
      failureThreshold: 0.5,
      minimumRequests: 10,
      halfOpenRequestLimit: 3,
      resetTimeout: 60000,
      fallbackEnabled: true
    },
    isActive: false,
    problem: '虽然启用了降级，但没有配置具体的降级策略'
  }
};

async function createBadConfigs() {
  const badConfigPath = path.join(__dirname, '..', '..', 'data', 'bad-policies.json');
  const dir = path.dirname(badConfigPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(badConfigPath, JSON.stringify(badPolicies, null, 2));
  console.log('坏配置示例已保存到: ' + badConfigPath);
  
  for (const [key, policy] of Object.entries(badPolicies)) {
    await Policy.create({
      ...policy,
      name: `[BAD] ${policy.name}`,
      metadata: {
        isBadExample: true,
        problem: policy.problem
      }
    });
  }
  
  console.log('坏配置示例已创建（已禁用状态）');
}

seed()
  .then(() => {
    console.log('Seed 完成！');
    process.exit(0);
  })
  .catch(error => {
    console.error('Seed 失败:', error);
    process.exit(1);
  });
