const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化测试数据...');

  const version = 'v2.1.0';

  await prisma.versionRelease.create({
    data: {
      version,
      description: '埋点验收台首次发布，包含核心统计和漏报检测功能',
      status: 'pending'
    }
  });

  const trackingPoints = [
    { name: '首页曝光', code: 'page_home_view', description: '用户进入首页时触发', page: '首页', eventType: 'pageview', version },
    { name: '首页点击搜索', code: 'click_home_search', description: '点击首页搜索框', page: '首页', eventType: 'click', version },
    { name: '首页点击Banner', code: 'click_home_banner', description: '点击首页Banner轮播图', page: '首页', eventType: 'click', version },
    { name: '商品列表曝光', code: 'page_product_list_view', description: '进入商品列表页', page: '商品列表', eventType: 'pageview', version },
    { name: '商品卡片点击', code: 'click_product_card', description: '点击商品卡片', page: '商品列表', eventType: 'click', version },
    { name: '商品详情曝光', code: 'page_product_detail_view', description: '进入商品详情页', page: '商品详情', eventType: 'pageview', version },
    { name: '加入购物车', code: 'click_add_cart', description: '点击加入购物车按钮', page: '商品详情', eventType: 'click', version },
    { name: '立即购买', code: 'click_buy_now', description: '点击立即购买按钮', page: '商品详情', eventType: 'click', version },
    { name: '购物车曝光', code: 'page_cart_view', description: '进入购物车页面', page: '购物车', eventType: 'pageview', version },
    { name: '结算点击', code: 'click_checkout', description: '点击结算按钮', page: '购物车', eventType: 'click', version },
    { name: '订单提交成功', code: 'order_submit_success', description: '订单提交成功', page: '订单确认', eventType: 'track', version },
    { name: '支付成功', code: 'pay_success', description: '支付成功回调', page: '支付结果', eventType: 'track', version }
  ];

  for (const point of trackingPoints) {
    await prisma.trackingPoint.create({ data: point });
  }
  console.log(`已创建${trackingPoints.length}个埋点定义`);

  const { v4: uuidv4 } = require('uuid');
  const sessionId = uuidv4();
  await prisma.debugSession.create({
    data: {
      sessionId,
      version,
      operator: '测试工程师张三',
      status: 'completed',
      endTime: new Date()
    }
  });
  console.log(`已创建测试会话: ${sessionId}`);

  const eventsToCreate = trackingPoints.slice(0, 10).map((point, index) => ({
    trackingCode: point.code,
    sessionId,
    pageUrl: `https://example.com${point.page === '首页' ? '' : '/' + point.page.toLowerCase().replace(/\s/g, '')}`,
    userId: 'user_001',
    properties: { test: true, index },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    ip: '192.168.1.100',
    idempotencyKey: uuidv4(),
    timestamp: new Date(Date.now() - (10 - index) * 60000),
    status: 'processed'
  }));

  for (const event of eventsToCreate) {
    await prisma.pageEvent.create({ data: event });
  }
  console.log(`已创建${eventsToCreate.length}个事件记录`);

  const missingPoints = trackingPoints.slice(10);
  for (let i = 0; i < missingPoints.length; i++) {
    const point = missingPoints[i];
    const detection = await prisma.missingDetection.create({
      data: {
        sessionId,
        trackingCode: point.code,
        expectedTime: new Date(),
        status: i === 0 ? 'confirmed' : 'pending',
        reason: i === 0 ? '确认漏报，前端未触发' : null
      }
    });
    if (i === 0) {
      await prisma.reviewLog.create({
        data: {
          detectionId: detection.id,
          action: '确认漏报',
          reason: '测试工程师现场复现，前端确实无上报',
          operator: '测试工程师张三'
        }
      });
    }
  }
  console.log(`已创建${missingPoints.length}条漏报记录`);

  console.log('✅ 测试数据初始化完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
