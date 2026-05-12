const orderService = require('../services/OrderService');
const complaintService = require('../services/ComplaintService');
const { COMPLAINT_STATUS, COMPLAINT_REJECT_REASONS } = require('../models/Complaint');
const store = require('./memoryStore');

function createTimeOffset(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

async function initializeSampleData() {
  store.clearAll();

  const samples = {
    orderCount: 0,
    complaintCount: 0,
    complaints: {}
  };

  const order1 = orderService.createOrder({
    orderNo: 'ORD-2026-001',
    userId: 'user-001',
    groupLeaderId: 'leader-A',
    items: [
      {
        productId: 'prod-apple',
        productName: '红富士苹果',
        expectedWeight: 2.5,
        unitPrice: 8.8,
        unit: 'kg'
      },
      {
        productId: 'prod-banana',
        productName: '香蕉',
        expectedWeight: 1.0,
        unitPrice: 5.5,
        unit: 'kg'
      }
    ],
    totalAmount: 27.5,
    orderTime: createTimeOffset(-24),
    deliveryTime: createTimeOffset(-20),
    status: 'DELIVERED'
  });
  samples.orderCount++;

  orderService.addWeightConfirmation(
    order1.id,
    order1.items[0].id,
    2.2,
    'https://example.com/photos/weigh-apple-001.jpg',
    'leader-A',
    '团长A'
  );
  orderService.addWeightConfirmation(
    order1.id,
    order1.items[1].id,
    0.98,
    'https://example.com/photos/weigh-banana-001.jpg',
    'leader-A',
    '团长A'
  );
  orderService.leaderConfirm(order1.id, 'leader-A', '团长A');

  const complaint1 = complaintService.createComplaint({
    orderId: order1.id,
    complaintItems: [
      {
        itemId: order1.items[0].id,
        productId: 'prod-apple',
        productName: '红富士苹果',
        claimedWeight: 2.2,
        claimedShortage: 0.3
      }
    ],
    description: '苹果实际称重2.2kg，比购买的2.5kg少了0.3kg',
    evidences: [
      {
        type: 'PHOTO',
        url: 'https://example.com/user/photos/user-001-apple.jpg',
        uploaderId: 'user-001',
        description: '用户自行称重照片'
      }
    ]
  }, 'idempotent-key-complaint-1');
  samples.complaintCount++;

  complaintService.submitForLeaderConfirm(
    complaint1.id,
    'cs-001',
    '客服小王'
  );

  complaintService.leaderConfirm(
    complaint1.id,
    { leaderConfirm: true },
    'leader-A',
    '团长A'
  );

  complaintService.trialCalculate(
    complaint1.id,
    'cs-001',
    '客服小王'
  );

  complaintService.approve(
    complaint1.id,
    'APPROVE',
    '确认为有效缺斤，按规则赔付',
    'supervisor-001',
    '主管老李'
  );

  const payment1 = complaintService.processPayment(
    complaint1.id,
    { method: 'BALANCE', paymentNo: 'PAY-2026-001' }
  );

  complaintService.handlePaymentCallback(
    complaint1.id,
    payment1.paymentNo,
    { success: true, result: { transactionId: 'TXN-001' } }
  );

  samples.complaints['场景1: 正常缺斤赔付'] = complaint1;

  const order2 = orderService.createOrder({
    orderNo: 'ORD-2026-002',
    userId: 'user-002',
    groupLeaderId: 'leader-A',
    items: [
      {
        productId: 'prod-orange',
        productName: '橙子',
        expectedWeight: 1.5,
        unitPrice: 6.0,
        unit: 'kg'
      }
    ],
    totalAmount: 9.0,
    orderTime: createTimeOffset(-30),
    deliveryTime: createTimeOffset(-28),
    status: 'DELIVERED'
  });
  samples.orderCount++;

  orderService.addWeightConfirmation(
    order2.id,
    order2.items[0].id,
    1.48,
    'https://example.com/photos/weigh-orange-002.jpg',
    'leader-A',
    '团长A'
  );
  orderService.leaderConfirm(order2.id, 'leader-A', '团长A');

  const complaint2 = complaintService.createComplaint({
    orderId: order2.id,
    complaintItems: [
      {
        itemId: order2.items[0].id,
        productId: 'prod-orange',
        productName: '橙子',
        claimedWeight: 1.48,
        claimedShortage: 0.02
      }
    ],
    description: '感觉少了20g'
  });
  samples.complaintCount++;

  complaintService.trialCalculate(
    complaint2.id,
    'cs-002',
    '客服小张'
  );

  samples.complaints['场景2: 正常驳回(误差容忍)'] = complaint2;

  const order3 = orderService.createOrder({
    orderNo: 'ORD-2026-003',
    userId: 'user-003',
    groupLeaderId: 'leader-B',
    items: [
      {
        productId: 'prod-watermelon',
        productName: '西瓜',
        expectedWeight: 5.0,
        unitPrice: 3.5,
        unit: 'kg'
      }
    ],
    totalAmount: 17.5,
    orderTime: createTimeOffset(-30),
    deliveryTime: createTimeOffset(-28),
    status: 'DELIVERED'
  });
  samples.orderCount++;

  orderService.addWeightConfirmation(
    order3.id,
    order3.items[0].id,
    5.02,
    'https://example.com/photos/weigh-watermelon-003.jpg',
    'leader-B',
    '团长B'
  );
  orderService.leaderConfirm(order3.id, 'leader-B', '团长B');

  const complaint3 = complaintService.createComplaint({
    orderId: order3.id,
    complaintItems: [
      {
        itemId: order3.items[0].id,
        productId: 'prod-watermelon',
        productName: '西瓜',
        claimedWeight: 4.0,
        claimedShortage: 1.0
      }
    ],
    description: '西瓜只有4kg，比买的5kg少了1kg，没有照片'
  });
  samples.complaintCount++;

  complaintService.trialCalculate(
    complaint3.id,
    'cs-002',
    '客服小张'
  );

  samples.complaints['场景3: 证据不足驳回'] = complaint3;

  const order4 = orderService.createOrder({
    orderNo: 'ORD-2026-004',
    userId: 'user-004',
    groupLeaderId: 'leader-C',
    items: [
      {
        productId: 'prod-grape',
        productName: '葡萄',
        expectedWeight: 1.0,
        unitPrice: 15.0,
        unit: 'kg'
      }
    ],
    totalAmount: 15.0,
    orderTime: createTimeOffset(-24),
    deliveryTime: createTimeOffset(-22),
    status: 'DELIVERED'
  });
  samples.orderCount++;

  orderService.addWeightConfirmation(
    order4.id,
    order4.items[0].id,
    0.85,
    'https://example.com/photos/weigh-grape-004.jpg',
    'leader-C',
    '团长C'
  );
  orderService.leaderConfirm(order4.id, 'leader-C', '团长C');

  const complaint4_first = complaintService.createComplaint({
    orderId: order4.id,
    complaintItems: [
      {
        itemId: order4.items[0].id,
        productId: 'prod-grape',
        productName: '葡萄',
        claimedWeight: 0.85,
        claimedShortage: 0.15
      }
    ],
    description: '第一次投诉葡萄缺斤',
    evidences: [
      {
        type: 'PHOTO',
        url: 'https://example.com/user/photos/user-004-grape.jpg',
        uploaderId: 'user-004',
        description: '称重照片'
      }
    ]
  });
  samples.complaintCount++;

  const complaint4_duplicate = complaintService.createComplaint({
    orderId: order4.id,
    complaintItems: [
      {
        itemId: order4.items[0].id,
        productId: 'prod-grape',
        productName: '葡萄',
        claimedWeight: 0.85,
        claimedShortage: 0.15
      }
    ],
    description: '第二次投诉同一问题'
  });
  samples.complaintCount++;

  samples.complaints['场景4-1: 原始投诉'] = complaint4_first;
  samples.complaints['场景4-2: 重复投诉(自动驳回)'] = complaint4_duplicate;

  const order5 = orderService.createOrder({
    orderNo: 'ORD-2026-005',
    userId: 'user-005',
    groupLeaderId: 'leader-A',
    items: [
      {
        productId: 'prod-pear',
        productName: '梨',
        expectedWeight: 2.0,
        unitPrice: 7.0,
        unit: 'kg'
      }
    ],
    totalAmount: 14.0,
    orderTime: createTimeOffset(-100),
    deliveryTime: createTimeOffset(-98),
    status: 'DELIVERED'
  });
  samples.orderCount++;

  const complaint5 = complaintService.createComplaint({
    orderId: order5.id,
    complaintItems: [
      {
        itemId: order5.items[0].id,
        productId: 'prod-pear',
        productName: '梨',
        claimedWeight: 1.5,
        claimedShortage: 0.5
      }
    ],
    description: '梨缺斤0.5kg，但是一周后才投诉'
  });
  samples.complaintCount++;

  samples.complaints['场景5: 超时投诉(48小时外)'] = complaint5;

  const order6 = orderService.createOrder({
    orderNo: 'ORD-2026-006',
    userId: 'user-006',
    groupLeaderId: 'leader-B',
    items: [
      {
        productId: 'prod-mango',
        productName: '芒果',
        expectedWeight: 1.5,
        unitPrice: 12.0,
        unit: 'kg'
      },
      {
        productId: 'prod-peach',
        productName: '桃子',
        expectedWeight: 1.0,
        unitPrice: 8.0,
        unit: 'kg'
      }
    ],
    totalAmount: 26.0,
    orderTime: createTimeOffset(-36),
    deliveryTime: createTimeOffset(-34),
    status: 'DELIVERED'
  });
  samples.orderCount++;

  orderService.addWeightConfirmation(
    order6.id,
    order6.items[0].id,
    1.3,
    'https://example.com/photos/weigh-mango-006.jpg',
    'leader-B',
    '团长B'
  );
  orderService.addWeightConfirmation(
    order6.id,
    order6.items[1].id,
    0.99,
    'https://example.com/photos/weigh-peach-006.jpg',
    'leader-B',
    '团长B'
  );
  orderService.leaderConfirm(order6.id, 'leader-B', '团长B');

  const complaint6 = complaintService.createComplaint({
    orderId: order6.id,
    complaintItems: [
      {
        itemId: order6.items[0].id,
        productId: 'prod-mango',
        productName: '芒果',
        claimedWeight: 1.3,
        claimedShortage: 0.2
      },
      {
        itemId: order6.items[1].id,
        productId: 'prod-peach',
        productName: '桃子',
        claimedWeight: 0.99,
        claimedShortage: 0.01
      }
    ],
    description: '芒果和桃子都感觉重量不够',
    evidences: [
      {
        type: 'PHOTO',
        url: 'https://example.com/user/photos/user-006-mango.jpg',
        uploaderId: 'user-006',
        description: '芒果称重照片'
      },
      {
        type: 'PHOTO',
        url: 'https://example.com/user/photos/user-006-peach.jpg',
        uploaderId: 'user-006',
        description: '桃子称重照片'
      }
    ]
  });
  samples.complaintCount++;

  complaintService.trialCalculate(
    complaint6.id,
    'cs-001',
    '客服小王'
  );

  complaintService.approve(
    complaint6.id,
    'APPROVE',
    '芒果部分缺斤有效，桃子在误差范围内',
    'supervisor-001',
    '主管老李'
  );

  const payment6 = complaintService.processPayment(
    complaint6.id,
    { method: 'WALLET', paymentNo: 'PAY-2026-006' }
  );

  complaintService.handlePaymentCallback(
    complaint6.id,
    payment6.paymentNo,
    { success: false, errorMessage: '用户余额不足', result: null }
  );

  samples.complaints['场景6: 部分商品缺斤(支付失败进入异常)'] = complaint6;

  const order7 = orderService.createOrder({
    orderNo: 'ORD-2026-007',
    userId: 'user-007',
    groupLeaderId: 'leader-D',
    items: [
      {
        productId: 'prod-strawberry',
        productName: '草莓',
        expectedWeight: 0.8,
        unitPrice: 25.0,
        unit: 'kg'
      }
    ],
    totalAmount: 20.0,
    orderTime: createTimeOffset(-20),
    deliveryTime: createTimeOffset(-18),
    status: 'DELIVERED'
  });
  samples.orderCount++;

  orderService.addWeightConfirmation(
    order7.id,
    order7.items[0].id,
    0.6,
    'https://example.com/photos/weigh-strawberry-007.jpg',
    'leader-D',
    '团长D'
  );
  orderService.leaderConfirm(order7.id, 'leader-D', '团长D');

  const complaint7 = complaintService.createComplaint({
    orderId: order7.id,
    complaintItems: [
      {
        itemId: order7.items[0].id,
        productId: 'prod-strawberry',
        productName: '草莓',
        claimedWeight: 0.6,
        claimedShortage: 0.2
      }
    ],
    description: '草莓缺少了200g，缺斤很多',
    evidences: [
      {
        type: 'PHOTO',
        url: 'https://example.com/user/photos/user-007-strawberry.jpg',
        uploaderId: 'user-007',
        description: '称重照片'
      }
    ]
  });
  samples.complaintCount++;

  complaintService.trialCalculate(
    complaint7.id,
    'cs-001',
    '客服小王'
  );

  samples.complaints['场景7: 待审批(可演示审批+人工修正)'] = complaint7;

  return samples;
}

module.exports = {
  initializeSampleData
};
