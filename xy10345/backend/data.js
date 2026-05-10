const { v4: uuidv4 } = require('uuid');

// 模拟数据库
const properties = [
  {
    id: 'prop-1',
    name: '海景公寓 A101',
    address: '深圳市南山区海滨大道 101 号',
    status: 'active',
    maxGuests: 4,
    createdAt: new Date('2024-01-01').toISOString()
  },
  {
    id: 'prop-2',
    name: '城市民宿 B202',
    address: '北京市朝阳区建国路 202 号',
    status: 'active',
    maxGuests: 2,
    createdAt: new Date('2024-02-15').toISOString()
  },
  {
    id: 'prop-3',
    name: '度假别墅 C303',
    address: '杭州市西湖区龙井路 303 号',
    status: 'maintenance',
    maxGuests: 6,
    createdAt: new Date('2024-03-20').toISOString()
  }
];

const orders = [
  {
    id: 'order-1',
    propertyId: 'prop-1',
    guestName: '张三',
    guestPhone: '13800138001',
    checkIn: new Date('2025-05-10T14:00:00').toISOString(),
    checkOut: new Date('2025-05-12T12:00:00').toISOString(),
    status: 'active',
    createdAt: new Date('2025-05-01').toISOString()
  },
  {
    id: 'order-2',
    propertyId: 'prop-1',
    guestName: '李四',
    guestPhone: '13800138002',
    checkIn: new Date('2025-05-13T14:00:00').toISOString(),
    checkOut: new Date('2025-05-15T12:00:00').toISOString(),
    status: 'upcoming',
    createdAt: new Date('2025-05-02').toISOString()
  },
  {
    id: 'order-3',
    propertyId: 'prop-2',
    guestName: '王五',
    guestPhone: '13800138003',
    checkIn: new Date('2025-05-08T14:00:00').toISOString(),
    checkOut: new Date('2025-05-10T12:00:00').toISOString(),
    status: 'completed',
    createdAt: new Date('2025-04-28').toISOString()
  }
];

const passwords = [
  {
    id: 'pwd-1',
    propertyId: 'prop-1',
    orderId: 'order-1',
    type: 'guest',
    code: '123456',
    name: '张三-入住密码',
    validFrom: new Date('2025-05-10T14:00:00').toISOString(),
    validTo: new Date('2025-05-12T12:00:00').toISOString(),
    status: 'active',
    reason: '正常入住期间',
    createdAt: new Date('2025-05-01').toISOString()
  },
  {
    id: 'pwd-2',
    propertyId: 'prop-1',
    orderId: null,
    type: 'cleaning',
    code: '654321',
    name: '保洁密码',
    validFrom: new Date('2025-05-01T00:00:00').toISOString(),
    validTo: new Date('2025-12-31T23:59:59').toISOString(),
    status: 'active',
    reason: '长期有效保洁密码',
    createdAt: new Date('2025-01-01').toISOString()
  },
  {
    id: 'pwd-3',
    propertyId: 'prop-3',
    orderId: null,
    type: 'maintenance',
    code: '111111',
    name: '维修临时密码',
    validFrom: new Date('2025-05-10T09:00:00').toISOString(),
    validTo: new Date('2025-05-10T18:00:00').toISOString(),
    status: 'active',
    reason: '维修期间临时授权',
    createdAt: new Date('2025-05-09').toISOString()
  },
  {
    id: 'pwd-4',
    propertyId: 'prop-2',
    orderId: 'order-3',
    type: 'guest',
    code: '222222',
    name: '王五-入住密码',
    validFrom: new Date('2025-05-08T14:00:00').toISOString(),
    validTo: new Date('2025-05-10T12:00:00').toISOString(),
    status: 'expired',
    reason: '已退房，密码自动失效',
    createdAt: new Date('2025-04-28').toISOString()
  },
  {
    id: 'pwd-5',
    propertyId: 'prop-1',
    orderId: 'order-2',
    type: 'guest',
    code: '333333',
    name: '李四-入住密码',
    validFrom: new Date('2025-05-13T14:00:00').toISOString(),
    validTo: new Date('2025-05-15T12:00:00').toISOString(),
    status: 'pending',
    reason: '未到入住时间，密码暂未生效',
    createdAt: new Date('2025-05-02').toISOString()
  }
];

const auditLogs = [
  {
    id: 'log-1',
    propertyId: 'prop-1',
    passwordId: 'pwd-1',
    action: 'generate',
    description: '生成入住密码',
    timestamp: new Date('2025-05-01T10:00:00').toISOString()
  },
  {
    id: 'log-2',
    propertyId: 'prop-2',
    passwordId: 'pwd-4',
    action: 'expire',
    description: '退房后自动失效',
    timestamp: new Date('2025-05-10T12:00:00').toISOString()
  }
];

const anomalies = [
  {
    id: 'anomaly-1',
    propertyId: 'prop-2',
    passwordId: 'pwd-4',
    type: 'expired_still_active',
    description: '检测到过期密码尝试访问',
    severity: 'high',
    timestamp: new Date('2025-05-10T13:00:00').toISOString(),
    resolved: true,
    resolution: '已自动拦截并记录'
  }
];

module.exports = {
  properties,
  orders,
  passwords,
  auditLogs,
  anomalies
};
