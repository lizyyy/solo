const { initDatabase } = require('../config/database');
const Task = require('../models/Task');
const ContextPackage = require('../models/ContextPackage');
const Evaluation = require('../models/Evaluation');
const TokenStrategy = require('../models/TokenStrategy');
const tokenService = require('../services/tokenService');

const seedTasks = [
  {
    name: '电商客服对话分析',
    description: '分析电商客服与用户的对话，评估上下文窗口大小对服务质量的影响'
  },
  {
    name: '代码审查对话',
    description: '评估代码审查场景下的上下文裁剪策略'
  },
  {
    name: '医疗咨询对话',
    description: '分析医疗咨询场景下的高风险上下文处理'
  }
];

const seedConversations = [
  {
    role: 'system',
    content: '你是一个专业的电商客服助手，需要帮助用户解决订单问题。请保持礼貌和专业。',
    timestamp: 1
  },
  {
    role: 'user',
    content: '你好，我上周在你们店里买了一件蓝色的T恤，但是收到的是红色的。我想要换货或者退款。',
    timestamp: 2
  },
  {
    role: 'assistant',
    content: '非常抱歉给您带来了不便！让我先确认一下您的订单信息。请问您的订单号是多少呢？',
    timestamp: 3
  },
  {
    role: 'user',
    content: '订单号是 20240501-8888。这件T恤是买给我弟弟的生日礼物，现在时间很紧迫。',
    timestamp: 4
  },
  {
    role: 'assistant',
    content: '感谢您提供订单号。我看到了您的订单，确实是蓝色 S 码的男士T恤，您收到了红色的。非常抱歉！由于您提到这是生日礼物，时间比较紧急，我可以为您提供两个方案：\n\n1. 快速换货：我们今天就为您发出正确的蓝色T恤，使用顺丰快递，预计明天到达。您收到后再把红色的寄回，运费由我们承担。\n\n2. 全额退款：您可以直接申请全额退款，同时我们会为您提供一张 50 元的优惠券作为补偿。\n\n您看哪个方案更适合您呢？',
    timestamp: 5
  },
  {
    role: 'user',
    content: '我选择第一个方案，换货。但是我明天就要出差，后天才能收到快递。你们能确保发顺丰吗？另外，寄回红色T恤的时候，运费谁出？',
    timestamp: 6
  },
  {
    role: 'assistant',
    content: '好的，我已经为您安排换货了！\n\n✅ 确认事项：\n- 我们今天会通过顺丰发出蓝色 S 码 T 恤\n- 快递单号会在发货后通过短信发送给您\n- 您收到后，请在 7 天内将红色 T 恤寄回\n- 寄回时选择到付即可，运费由我们承担\n\n另外，为了表示歉意，我额外为您申请了一张 30 元的优惠券，会在您确认收到正确商品后自动到账。\n\n如果还有其他问题，请随时告诉我！',
    timestamp: 7
  },
  {
    role: 'user',
    content: '太好了，谢谢你的帮助！你们的服务真的很贴心。对了，我还想再买一条裤子，有什么推荐吗？我弟弟身高 175cm，体重 65kg。',
    timestamp: 8
  },
  {
    role: 'assistant',
    content: '非常感谢您的认可！根据您提供的身高体重，我推荐以下几款裤子：\n\n1. 休闲直筒牛仔裤 - 这是我们的爆款，面料舒适，版型百搭。您弟弟这个身材穿 31 码应该合适。\n\n2. 运动束脚裤 - 采用速干面料，适合运动和日常穿着。弹性腰围设计，穿着更舒适。\n\n3. 商务休闲西裤 - 如果您弟弟需要正式一些的场合穿着，这款修身西裤是不错的选择。\n\n您需要我发一下具体的链接吗？或者您有其他偏好的颜色或款式？',
    timestamp: 9
  }
];

const seedDocs = `# 电商客服知识库

## 换货政策

1. 收货后 7 天内可申请换货
2. 商品需保持原包装、未使用状态
3. 因商家发错货导致的换货，往返运费均由商家承担
4. 紧急换货可申请顺丰速运，需客服特别审批

## 退款政策

1. 收货后 7 天内可申请无理由退款
2. 退款申请审核通过后，款项将在 3-5 个工作日内原路返回
3. 质量问题导致的退款，同时可申请额外优惠券补偿

## 优惠券使用规则

1. 优惠券有效期一般为 30 天
2. 每张订单只能使用一张优惠券
3. 优惠券不可兑换现金
4. 补偿性优惠券在特定条件下自动发放

## 常见问题

### Q: 换货需要多长时间？
A: 标准换货流程约 3-5 个工作日。紧急换货（顺丰）可在 1-2 个工作日内收到新商品。

### Q: 如何查询物流信息？
A: 发货后会通过短信发送快递单号，您也可以在订单详情页查看实时物流。

### Q: 退款到账时间？
A: 微信支付、支付宝一般 1-3 个工作日，银行卡支付可能需要 3-5 个工作日。`;

const seedToolResults = {
  orderQuery: {
    success: true,
    data: {
      orderId: '20240501-8888',
      orderDate: '2024-05-01',
      items: [
        {
          productId: 'PROD-001234',
          name: '男士基础款圆领T恤',
          color: '蓝色',
          size: 'S',
          quantity: 1,
          price: 99.00
        }
      ],
      totalAmount: 99.00,
      paymentMethod: '微信支付',
      status: '已收货',
      shippingAddress: {
        name: '张三',
        phone: '138****1234',
        address: '北京市朝阳区某某街道某某小区 1 号楼 101 室'
      }
    }
  },
  inventoryCheck: {
    success: true,
    data: {
      productId: 'PROD-001234',
      name: '男士基础款圆领T恤',
      availableStock: {
        '蓝色-S': 25,
        '蓝色-M': 42,
        '蓝色-L': 38,
        '红色-S': 15,
        '红色-M': 20,
        '红色-L': 18
      }
    }
  },
  couponQuery: {
    success: true,
    data: {
      availableCoupons: [
        {
          id: 'COUPON-2024-001',
          name: '新用户专享券',
          amount: 50,
          minSpend: 200,
          validUntil: '2024-12-31'
        },
        {
          id: 'COUPON-2024-002',
          name: '会员专享券',
          amount: 30,
          minSpend: 150,
          validUntil: '2024-06-30'
        }
      ]
    }
  },
  recommendProducts: {
    success: true,
    data: {
      userId: 'USER-12345',
      recommendations: [
        {
          productId: 'PROD-005678',
          name: '休闲直筒牛仔裤',
          price: 199.00,
          reason: '根据历史购买记录推荐'
        },
        {
          productId: 'PROD-005679',
          name: '运动束脚裤',
          price: 159.00,
          reason: '同类型商品热销'
        },
        {
          productId: 'PROD-005680',
          name: '商务休闲西裤',
          price: 259.00,
          reason: '新品上市'
        }
      ]
    }
  }
};

const seedBudget = {
  maxTokens: 8192,
  hardConstraints: {
    mustInclude: [
      'systemPrompt',
      'userLastMessage',
      'budgetConstraints'
    ],
    mustNotExceed: {
      conversations: 4000,
      docs: 2000,
      toolResults: 1500
    }
  },
  priorityRules: {
    budget: 100,
    systemPrompt: 95,
    recentMessages: 90,
    userMessages: 85,
    toolResults: 75,
    docs: 60,
    oldMessages: 30
  },
  summarizationRules: {
    enabled: true,
    minTokensForSummary: 1000,
    summaryRatio: 0.3
  },
  riskThresholds: {
    highRisk: {
      lostSystemMessage: true,
      lostRatio: 0.5,
      criticalDataLost: true
    },
    mediumRisk: {
      lostRatio: 0.3
    }
  }
};

async function runSeed() {
  console.log('🚀 开始初始化数据库并导入 seed 数据...');
  
  console.log('📦 初始化数据库...');
  await initDatabase();
  
  console.log('🔄 初始化默认 Token 策略...');
  TokenStrategy.initDefaultStrategies();
  
  console.log('📋 创建示例任务...');
  const createdTasks = [];
  for (const taskData of seedTasks) {
    const task = Task.create(taskData);
    createdTasks.push(task);
    console.log(`  ✅ 任务: ${task.name}`);
  }
  
  console.log('📦 创建示例上下文包...');
  const mainTask = createdTasks[0];
  
  const contextPackage = ContextPackage.create({
    taskId: mainTask.id,
    conversations: seedConversations,
    docs: seedDocs,
    toolResults: seedToolResults,
    budget: seedBudget
  });
  
  console.log(`  ✅ 上下文包已创建: ${contextPackage.id}`);
  console.log(`  📊 总 Token 数: ${contextPackage.totalTokens}`);
  
  console.log('🔍 运行评估...');
  
  const defaultStrategy = TokenStrategy.findDefault();
  const strategies = TokenStrategy.findAll();
  
  for (const strategy of strategies.slice(0, 3)) {
    console.log(`  📊 使用策略: ${strategy.name} (${strategy.maxTokens} tokens)`);
    
    const contextData = contextPackage.toContextData();
    const result = tokenService.applyTokenBudget(contextData, {
      maxTokens: strategy.maxTokens,
      priorityRules: strategy.priorityRules
    });
    
    const evaluation = Evaluation.create({
      contextPackageId: contextPackage.id,
      strategyId: strategy.id,
      result,
      notes: `使用 ${strategy.name} 策略进行的评估，保留率: ${Math.round((result.statistics.totalRetainedTokens / result.statistics.totalOriginalTokens) * 100)}%`
    });
    
    console.log(`    ✅ 评估完成: ${evaluation.id}`);
    console.log(`    📈 保留: ${result.statistics.totalRetainedTokens}, 丢失: ${result.statistics.totalLostTokens}`);
    console.log(`    ⚠️ 风险等级: ${evaluation.riskLevel}`);
  }
  
  console.log('');
  console.log('✅ Seed 数据导入完成！');
  console.log('');
  console.log('📊 摘要:');
  console.log(`  - 创建任务: ${createdTasks.length} 个`);
  console.log(`  - 创建上下文包: 1 个`);
  console.log(`  - 运行评估: 3 个`);
  console.log('');
  console.log('🔑 可用策略:');
  strategies.forEach(s => {
    console.log(`  - ${s.name}: ${s.maxTokens} tokens ${s.isDefault ? '(默认)' : ''}`);
  });
}

runSeed().catch(error => {
  console.error('❌ Seed 数据导入失败:', error);
  process.exit(1);
});
