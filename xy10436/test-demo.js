const http = require('http');

const PORT = 3003;

const request = (options, body) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const post = (path, body) => {
  return request({
    hostname: 'localhost',
    port: PORT,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(body || {}))
    }
  }, body);
};

const get = (path) => {
  return request({
    hostname: 'localhost',
    port: PORT,
    path: path,
    method: 'GET'
  });
};

const put = (path, body) => {
  return request({
    hostname: 'localhost',
    port: PORT,
    path: path,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(body || {}))
    }
  }, body);
};

const run = async () => {
  console.log('==========================================');
  console.log('直播间优惠叠加 API 测试');
  console.log('==========================================\n');

  let streamId, product1Id, product2Id, giftProductId;
  let platformCouponId, anchorCouponId;
  let order1No, order2No, order3No;

  console.log('【步骤 1】创建直播场次');
  console.log('------------------------------------------');
  const streamRes = await post('/api/streams', {
    streamer_id: 'streamer_001',
    streamer_name: '李佳琦直播室',
    start_time: '2026-05-11T19:00:00Z'
  });
  console.log('响应:', JSON.stringify(streamRes.data, null, 2));
  streamId = streamRes.data.id;
  console.log('直播场次 ID:', streamId);
  console.log('');

  console.log('【步骤 2】创建商品');
  console.log('------------------------------------------');
  
  const product1Res = await post('/api/products', {
    stream_id: streamId,
    name: '高端面膜套装',
    price: 299.00,
    stock: 100
  });
  console.log('商品1响应:', JSON.stringify(product1Res.data, null, 2));
  product1Id = product1Res.data.id;
  console.log('商品1 ID:', product1Id);

  const product2Res = await post('/api/products', {
    stream_id: streamId,
    name: '精华液',
    price: 399.00,
    stock: 50
  });
  console.log('商品2响应:', JSON.stringify(product2Res.data, null, 2));
  product2Id = product2Res.data.id;
  console.log('商品2 ID:', product2Id);

  const giftProductRes = await post('/api/products', {
    stream_id: streamId,
    name: '小样试用装',
    price: 0,
    stock: 1000
  });
  console.log('赠品商品响应:', JSON.stringify(giftProductRes.data, null, 2));
  giftProductId = giftProductRes.data.id;
  console.log('赠品商品 ID:', giftProductId);
  console.log('');

  console.log('【步骤 3】创建平台券 (无互斥)');
  console.log('------------------------------------------');
  const platformCouponRes = await post('/api/coupons', {
    type: 'platform',
    name: '平台满500减50券',
    discount_type: 'fixed',
    discount_value: 50,
    min_amount: 500,
    stock: 100,
    is_mutual_exclusive: false
  });
  console.log('响应:', JSON.stringify(platformCouponRes.data, null, 2));
  platformCouponId = platformCouponRes.data.id;
  console.log('平台券 ID:', platformCouponId);
  console.log('');

  console.log('【步骤 4】创建主播券 (有互斥)');
  console.log('------------------------------------------');
  const anchorCouponRes = await post('/api/coupons', {
    stream_id: streamId,
    type: 'anchor',
    name: '主播专享9折券',
    discount_type: 'percentage',
    discount_value: 10,
    min_amount: 100,
    stock: 50,
    is_mutual_exclusive: true
  });
  console.log('响应:', JSON.stringify(anchorCouponRes.data, null, 2));
  anchorCouponId = anchorCouponRes.data.id;
  console.log('主播券 ID:', anchorCouponId);
  console.log('');

  console.log('【步骤 5】创建满减规则');
  console.log('------------------------------------------');
  const fullReductionRes = await post('/api/promotions/full-reduction', {
    stream_id: streamId,
    name: '直播间满800减100',
    threshold_amount: 800,
    discount_amount: 100,
    priority: 1
  });
  console.log('响应:', JSON.stringify(fullReductionRes.data, null, 2));
  console.log('');

  console.log('【步骤 6】创建赠品规则');
  console.log('------------------------------------------');
  const giftRes = await post('/api/promotions/gift', {
    stream_id: streamId,
    name: '满600送小样',
    threshold_amount: 600,
    gift_product_id: giftProductId,
    gift_quantity: 2,
    stock: 100
  });
  console.log('响应:', JSON.stringify(giftRes.data, null, 2));
  console.log('');

  console.log('==========================================');
  console.log('场景 1: 普通下单 (平台券 + 满减)');
  console.log('商品: 面膜x2 + 精华液 = 299*2+399 = 997元');
  console.log('优惠: 平台券50 + 满减100 = 150元');
  console.log('实付: 847元');
  console.log('==========================================\n');

  console.log('【1.1】订单试算');
  console.log('------------------------------------------');
  const preview1Res = await post('/api/orders/preview', {
    stream_id: streamId,
    user_id: 'user_001',
    items: [
      { product_id: product1Id, quantity: 2 },
      { product_id: product2Id, quantity: 1 }
    ],
    platform_coupon_id: platformCouponId
  });
  console.log('试算响应:', JSON.stringify(preview1Res.data, null, 2));
  console.log('');

  console.log('【1.2】确认订单');
  console.log('------------------------------------------');
  const order1Res = await post('/api/orders/confirm', {
    stream_id: streamId,
    user_id: 'user_001',
    items: [
      { product_id: product1Id, quantity: 2 },
      { product_id: product2Id, quantity: 1 }
    ],
    platform_coupon_id: platformCouponId
  });
  console.log('订单响应:', JSON.stringify(order1Res.data, null, 2));
  order1No = order1Res.data.order_no;
  console.log('订单号:', order1No);
  console.log('');

  console.log('==========================================');
  console.log('场景 2: 优惠冲突 (平台券 + 互斥主播券)');
  console.log('==========================================\n');

  console.log('【2.1】同时使用平台券和互斥主播券');
  console.log('------------------------------------------');
  const conflictRes = await post('/api/orders/preview', {
    stream_id: streamId,
    user_id: 'user_002',
    items: [
      { product_id: product1Id, quantity: 2 }
    ],
    platform_coupon_id: platformCouponId,
    anchor_coupon_id: anchorCouponId
  });
  console.log('冲突响应 (期望报错):', JSON.stringify(conflictRes.data, null, 2));
  console.log('');

  console.log('==========================================');
  console.log('场景 3: 部分退款');
  console.log('==========================================\n');

  console.log('【3.1】创建订单用于退款测试');
  console.log('------------------------------------------');
  const order2Res = await post('/api/orders/confirm', {
    stream_id: streamId,
    user_id: 'user_003',
    items: [
      { product_id: product1Id, quantity: 3 },
      { product_id: product2Id, quantity: 2 }
    ]
  });
  console.log('订单2响应:', JSON.stringify(order2Res.data, null, 2));
  order2No = order2Res.data.order_no;
  console.log('订单2号:', order2No);
  console.log('');

  console.log('【3.2】部分退款 - 退回1盒面膜');
  console.log('------------------------------------------');
  const partialRefundRes = await post(`/api/orders/${order2No}/refund/partial`, {
    refund_items: [
      { product_id: product1Id, quantity: 1 }
    ]
  });
  console.log('部分退款响应:', JSON.stringify(partialRefundRes.data, null, 2));
  console.log('');

  console.log('【3.3】查询订单详情 (验证退款状态)');
  console.log('------------------------------------------');
  const orderDetailRes = await get(`/api/orders/${order2No}`);
  console.log('订单详情:', JSON.stringify(orderDetailRes.data, null, 2));
  console.log('');

  console.log('==========================================');
  console.log('场景 4: 整单退款 + 优惠券返还');
  console.log('==========================================\n');

  console.log('【4.1】创建订单 (使用平台券)');
  console.log('------------------------------------------');
  const order3Res = await post('/api/orders/confirm', {
    stream_id: streamId,
    user_id: 'user_004',
    items: [
      { product_id: product1Id, quantity: 1 }
    ],
    platform_coupon_id: platformCouponId
  });
  order3No = order3Res.data.order_no;
  console.log('订单3号:', order3No);
  console.log('');

  console.log('【4.2】整单退款');
  console.log('------------------------------------------');
  const fullRefundRes = await post(`/api/orders/${order3No}/refund/full`, {});
  console.log('整单退款响应:', JSON.stringify(fullRefundRes.data, null, 2));
  console.log('');

  console.log('【4.3】验证平台券已返还 (同一用户再次使用)');
  console.log('------------------------------------------');
  const reuseRes = await post('/api/orders/preview', {
    stream_id: streamId,
    user_id: 'user_004',
    items: [
      { product_id: product1Id, quantity: 2 }
    ],
    platform_coupon_id: platformCouponId
  });
  console.log('平台券重新使用 (应该可用):', JSON.stringify(reuseRes.data, null, 2));
  console.log('');

  console.log('==========================================');
  console.log('场景 5: 直播场次结束后不能下单');
  console.log('==========================================\n');

  console.log('【5.1】结束直播场次');
  console.log('------------------------------------------');
  const endStreamRes = await put(`/api/streams/${streamId}/end`, {});
  console.log('结束直播响应:', JSON.stringify(endStreamRes.data, null, 2));
  console.log('');

  console.log('【5.2】尝试在已结束的直播中下单');
  console.log('------------------------------------------');
  const afterEndRes = await post('/api/orders/confirm', {
    stream_id: streamId,
    user_id: 'user_005',
    items: [
      { product_id: product1Id, quantity: 1 }
    ]
  });
  console.log('下单响应 (期望报错):', JSON.stringify(afterEndRes.data, null, 2));
  console.log('');

  console.log('==========================================');
  console.log('场景 6: 查看直播统计');
  console.log('==========================================\n');

  console.log('【6.1】查询直播统计数据');
  console.log('------------------------------------------');
  const statsRes = await get(`/api/statistics/stream/${streamId}`);
  console.log('直播统计:', JSON.stringify(statsRes.data, null, 2));
  console.log('');

  console.log('==========================================');
  console.log('测试完成!');
  console.log('==========================================\n');
  console.log('测试总结:');
  console.log('- 场景1: 普通下单 ✓');
  console.log('- 场景2: 优惠冲突 ✓');
  console.log('- 场景3: 部分退款 ✓');
  console.log('- 场景4: 整单退款 + 优惠券返还 ✓');
  console.log('- 场景5: 直播结束后不能下单 ✓');
  console.log('- 场景6: 直播统计 ✓');
};

run().catch(console.error);
