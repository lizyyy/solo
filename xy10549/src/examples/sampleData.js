const { addDays, now } = require('../utils/date');

const SAMPLE_WAYBILLS = [
  {
    waybillId: 'SF1001234567890',
    customerName: '张三',
    carrier: '顺丰速运',
    origin: '上海市浦东新区',
    destination: '北京市朝阳区',
    expectedDeliveryTime: addDays(now(), -2).toISOString(),
    actualDeliveryTime: addDays(now(), 1).toISOString(),
    insuredAmount: 5000,
    itemValue: 5000,
    trackingEvents: [
      {
        location: '上海转运中心',
        status: '已揽收',
        time: addDays(now(), -5).toISOString()
      },
      {
        location: '上海虹桥机场',
        status: '已发出',
        time: addDays(now(), -4).toISOString()
      },
      {
        location: '北京首都机场',
        status: '已到达',
        time: addDays(now(), -3).toISOString()
      },
      {
        location: '北京转运中心',
        status: '等待派送',
        time: addDays(now(), -2).toISOString()
      },
      {
        location: '北京朝阳区',
        status: '派送中',
        time: addDays(now(), -1).toISOString()
      }
    ]
  },
  {
    waybillId: 'YTO2001234567890',
    customerName: '李四（VIP）',
    carrier: '圆通速递',
    origin: '广州市天河区',
    destination: '深圳市南山区',
    expectedDeliveryTime: addDays(now(), -3).toISOString(),
    actualDeliveryTime: addDays(now(), 1).toISOString(),
    insuredAmount: 3000,
    itemValue: 3000,
    trackingEvents: [
      {
        location: '广州转运中心',
        status: '已揽收',
        time: addDays(now(), -4).toISOString()
      },
      {
        location: '广州转运中心',
        status: '已发出',
        time: addDays(now(), -3).toISOString()
      },
      {
        location: '深圳转运中心',
        status: '已到达',
        time: addDays(now(), -1).toISOString()
      }
    ]
  },
  {
    waybillId: 'EMS3001234567890',
    customerName: '王五（VIP+）',
    carrier: 'EMS',
    origin: '成都市武侯区',
    destination: '重庆市渝北区',
    expectedDeliveryTime: addDays(now(), -2).toISOString(),
    actualDeliveryTime: addDays(now(), 0).toISOString(),
    insuredAmount: 10000,
    itemValue: 10000,
    trackingEvents: [
      {
        location: '成都处理中心',
        status: '已揽收',
        time: addDays(now(), -3).toISOString()
      },
      {
        location: '成都处理中心',
        status: '已发出',
        time: addDays(now(), -2).toISOString()
      },
      {
        location: '重庆处理中心',
        status: '已到达（因暴雨延误）',
        time: addDays(now(), 0).toISOString()
      }
    ]
  },
  {
    waybillId: 'JD4001234567890',
    customerName: '赵六',
    carrier: '京东物流',
    origin: '杭州市西湖区',
    destination: '南京市鼓楼区',
    expectedDeliveryTime: addDays(now(), -2).toISOString(),
    actualDeliveryTime: addDays(now(), 0).toISOString(),
    insuredAmount: 8000,
    itemValue: 8000,
    trackingEvents: [
      {
        location: '杭州仓储中心',
        status: '已揽收',
        time: addDays(now(), -3).toISOString()
      },
      {
        location: '杭州转运中心',
        status: '已发出',
        time: addDays(now(), -2).toISOString()
      },
      {
        location: '南京转运中心',
        status: '已到达',
        time: addDays(now(), -1).toISOString()
      }
    ]
  },
  {
    waybillId: 'YUNDA5001234567890',
    customerName: '孙七（VIP）',
    carrier: '韵达快递',
    origin: '武汉市洪山区',
    destination: '长沙市芙蓉区',
    expectedDeliveryTime: addDays(now(), -3).toISOString(),
    actualDeliveryTime: addDays(now(), -1).toISOString(),
    insuredAmount: 6000,
    itemValue: 6000,
    trackingEvents: [
      {
        location: '武汉转运中心',
        status: '已揽收',
        time: addDays(now(), -4).toISOString()
      },
      {
        location: '武汉转运中心',
        status: '已发出',
        time: addDays(now(), -3).toISOString()
      },
      {
        location: '长沙转运中心',
        status: '已到达',
        time: addDays(now(), -2).toISOString()
      },
      {
        location: '长沙芙蓉区',
        status: '已签收',
        time: addDays(now(), -1).toISOString()
      }
    ]
  }
];

const SAMPLE_SHIPMENTS = [
  {
    waybillId: 'SF1001234567890',
    type: 'delay',
    description: '快件延误 3 天未送达，客户多次催促',
    customerLevel: 'normal',
    customerName: '张三',
    carrier: '顺丰速运'
  },
  {
    waybillId: 'YTO2001234567890',
    type: 'damage',
    description: '收到包裹时发现外包装破损，内部电子产品有磕碰痕迹',
    customerLevel: 'vip',
    customerName: '李四（VIP）',
    carrier: '圆通速递',
    damagePercentage: 30
  },
  {
    waybillId: 'EMS3001234567890',
    type: 'lost',
    description: '包裹在运输途中丢失，一直没有更新物流信息',
    customerLevel: 'vip_plus',
    customerName: '王五（VIP+）',
    carrier: 'EMS'
  },
  {
    waybillId: 'JD4001234567890',
    type: 'damage',
    description: '包裹内物品破损，但只提供了 1 张照片证据',
    customerLevel: 'normal',
    customerName: '赵六',
    carrier: '京东物流',
    damagePercentage: 50
  },
  {
    waybillId: 'YUNDA5001234567890',
    type: 'delay',
    description: '因暴雨天气延误，属于不可抗力',
    customerLevel: 'vip',
    customerName: '孙七（VIP）',
    carrier: '韵达快递'
  }
];

const SAMPLE_EVIDENCES = [
  {
    type: 'photo',
    url: 'evidence://photo_1.jpg',
    description: '外包装破损照片 1'
  },
  {
    type: 'photo',
    url: 'evidence://photo_2.jpg',
    description: '外包装破损照片 2'
  },
  {
    type: 'video',
    url: 'evidence://video_1.mp4',
    description: '开箱视频'
  }
];

const SAMPLE_APPEAL = {
  reason: '认为赔付金额过低，提供新的购买凭证证明商品价值更高',
  requestedAmount: 3000
};

module.exports = {
  SAMPLE_WAYBILLS,
  SAMPLE_SHIPMENTS,
  SAMPLE_EVIDENCES,
  SAMPLE_APPEAL
};
