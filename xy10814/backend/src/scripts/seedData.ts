import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { Contract } from '../entities/Contract';
import { ResponseScene } from '../entities/ResponseScene';
import { ExceptionTemplate } from '../entities/ExceptionTemplate';

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected');

  const contractRepository = AppDataSource.getRepository(Contract);
  const sceneRepository = AppDataSource.getRepository(ResponseScene);
  const exceptionRepository = AppDataSource.getRepository(ExceptionTemplate);

  console.log('Clearing existing data...');
  await sceneRepository.clear();
  await contractRepository.clear();
  await exceptionRepository.clear();

  console.log('Creating contracts...');
  
  const userContract = contractRepository.create({
    name: '获取用户信息',
    path: '/api/user',
    method: 'GET',
    description: '获取当前登录用户的详细信息',
    isActive: true,
    environment: 'development'
  });
  await contractRepository.save(userContract);

  const orderContract = contractRepository.create({
    name: '创建订单',
    path: '/api/order',
    method: 'POST',
    description: '创建新订单接口',
    isActive: true,
    environment: 'development'
  });
  await contractRepository.save(orderContract);

  const paymentContract = contractRepository.create({
    name: '支付接口',
    path: '/api/payment',
    method: 'POST',
    description: '订单支付处理',
    isActive: true,
    environment: 'development'
  });
  await contractRepository.save(paymentContract);

  console.log('Creating response scenes...');

  const scenes = [
    {
      name: '成功获取用户信息',
      contractId: userContract.id,
      matchRules: [],
      responseBody: {
        success: true,
        data: {
          id: 1001,
          username: 'test_user',
          email: 'user@example.com',
          avatar: 'https://example.com/avatar.jpg',
          createdAt: '2024-01-15T10:30:00Z'
        }
      },
      statusCode: 200,
      isDefault: true,
      isEnabled: true,
      delayConfig: {
        enabled: true,
        fixedDelay: 500,
        strategy: 'fixed'
      }
    },
    {
      name: '用户未授权',
      contractId: userContract.id,
      matchRules: [
        { type: 'header', key: 'Authorization', value: '', operator: 'exists' }
      ],
      responseBody: {
        success: false,
        error: 'Unauthorized',
        message: '请先登录'
      },
      statusCode: 401,
      isDefault: false,
      isEnabled: true
    },
    {
      name: '创建订单成功',
      contractId: orderContract.id,
      matchRules: [],
      responseBody: {
        success: true,
        data: {
          orderId: 'ORD-2024-001',
          amount: 99.99,
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      },
      statusCode: 201,
      isDefault: true,
      isEnabled: true,
      delayConfig: {
        enabled: true,
        minDelay: 200,
        maxDelay: 1000,
        strategy: 'random'
      }
    },
    {
      name: '订单参数错误',
      contractId: orderContract.id,
      matchRules: [
        { type: 'body', key: 'productId', value: '', operator: 'exists' }
      ],
      responseBody: {
        success: false,
        error: 'ValidationError',
        message: '商品ID不能为空',
        details: ['productId is required']
      },
      statusCode: 400,
      isDefault: false,
      isEnabled: true
    },
    {
      name: '重复提交订单',
      contractId: orderContract.id,
      matchRules: [
        { type: 'header', key: 'X-Idempotency-Key', value: 'duplicate', operator: 'equals' }
      ],
      responseBody: {
        success: false,
        error: 'DuplicateRequest',
        message: '订单正在处理中，请勿重复提交',
        requestId: 'req-duplicate-001'
      },
      statusCode: 409,
      isDefault: false,
      isEnabled: true
    },
    {
      name: '支付成功',
      contractId: paymentContract.id,
      matchRules: [],
      responseBody: {
        success: true,
        data: {
          transactionId: 'TXN-PAY-2024-8888',
          amount: 99.99,
          currency: 'CNY',
          status: 'completed',
          paidAt: new Date().toISOString()
        }
      },
      statusCode: 200,
      isDefault: true,
      isEnabled: true
    },
    {
      name: '支付超时',
      contractId: paymentContract.id,
      matchRules: [
        { type: 'body', key: 'timeout', value: 'true', operator: 'equals' }
      ],
      responseBody: {
        success: false,
        error: 'PaymentTimeout',
        message: '支付处理超时，请稍后重试',
        retryAfter: 300
      },
      statusCode: 408,
      isDefault: false,
      isEnabled: true,
      delayConfig: {
        enabled: true,
        fixedDelay: 5000,
        strategy: 'fixed'
      }
    },
    {
      name: '余额不足',
      contractId: paymentContract.id,
      matchRules: [
        { type: 'body', key: 'amount', value: '1000', operator: 'equals' }
      ],
      responseBody: {
        success: false,
        error: 'InsufficientBalance',
        message: '账户余额不足',
        currentBalance: 500.00
      },
      statusCode: 422,
      isDefault: false,
      isEnabled: true
    }
  ];

  for (const sceneData of scenes) {
    const scene = sceneRepository.create(sceneData);
    await sceneRepository.save(scene);
  }

  console.log('Creating exception templates...');
  
  const exceptions = [
    {
      name: '系统维护中',
      type: 'maintenance',
      responseBody: {
        success: false,
        error: 'ServiceUnavailable',
        message: '系统正在维护中，预计 30 分钟后恢复',
        maintainEndTime: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      },
      statusCode: 503,
      description: '系统维护模式响应模板'
    },
    {
      name: '限流触发',
      type: 'rate_limit',
      responseBody: {
        success: false,
        error: 'RateLimitExceeded',
        message: '请求过于频繁，请稍后再试',
        limit: 100,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 60
      },
      statusCode: 429,
      description: '接口限流响应模板'
    },
    {
      name: '数据库错误',
      type: 'database',
      responseBody: {
        success: false,
        error: 'DatabaseError',
        message: '数据库连接异常，请联系管理员'
      },
      statusCode: 500,
      description: '数据库异常响应模板'
    }
  ];

  for (const exceptionData of exceptions) {
    const exception = exceptionRepository.create(exceptionData);
    await exceptionRepository.save(exception);
  }

  console.log('Seed data created successfully!');
  console.log(`Created ${3} contracts`);
  console.log(`Created ${scenes.length} scenes`);
  console.log(`Created ${exceptions.length} exception templates`);
  
  await AppDataSource.destroy();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
