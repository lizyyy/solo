const { v4: uuidv4 } = require('uuid');

const StatusEnum = {
  CREATED: 'created',
  ASSIGNED: 'assigned',
  PICKED_UP: 'picked_up',
  IN_WASH: 'in_wash',
  WASHED: 'washed',
  DISPATCHING: 'dispatching',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  DISPUTE: 'dispute',
  RESOLVED: 'resolved'
};

const routes = [
  {
    id: 'route-a',
    name: 'A区-市中心',
    areas: ['市中心', '东城区', '西城区'],
    driver: '张师傅',
    vehicle: '京A12345'
  },
  {
    id: 'route-b',
    name: 'B区-科技园',
    areas: ['科技园', '软件园', '创新街'],
    driver: '李师傅',
    vehicle: '京B67890'
  },
  {
    id: 'route-c',
    name: 'C区-住宅区',
    areas: ['幸福小区', '阳光花园', '碧水湾'],
    driver: '王师傅',
    vehicle: '京C11111'
  }
];

const users = [
  { id: 'admin', name: '管理员', role: 'admin' },
  { id: 'dispatcher1', name: '调度员小王', role: 'dispatcher' },
  { id: 'dispatcher2', name: '调度员小李', role: 'dispatcher' }
];

const orders = [
  {
    id: 'ORD001',
    customerName: '张明',
    phone: '13800138001',
    address: '东城区幸福路88号',
    area: '东城区',
    orderTime: new Date(Date.now() - 86400000).toISOString(),
    estimatedDelivery: new Date(Date.now() + 86400000 * 2).toISOString(),
    status: StatusEnum.CREATED,
    isUrgent: false,
    totalFee: 120,
    urgentFee: 0,
    routeId: null,
    items: [
      { name: '西装', quantity: 2, unitPrice: 40 },
      { name: '衬衫', quantity: 4, unitPrice: 10 }
    ],
    changes: [],
    defects: [],
    batchNo: 'BATCH001'
  },
  {
    id: 'ORD002',
    customerName: '张明',
    phone: '13800138001',
    address: '东城区幸福路88号',
    area: '东城区',
    orderTime: new Date(Date.now() - 86400000).toISOString(),
    estimatedDelivery: new Date(Date.now() + 86400000 * 2).toISOString(),
    status: StatusEnum.CREATED,
    isUrgent: false,
    totalFee: 50,
    urgentFee: 0,
    routeId: null,
    items: [
      { name: '裤子', quantity: 2, unitPrice: 20 },
      { name: '领带', quantity: 1, unitPrice: 10 }
    ],
    changes: [],
    defects: [],
    batchNo: 'BATCH002'
  },
  {
    id: 'ORD003',
    customerName: '李明',
    phone: '13900139002',
    address: '科技园创新大道100号',
    area: '科技园',
    orderTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    estimatedDelivery: new Date(Date.now() + 86400000).toISOString(),
    status: StatusEnum.ASSIGNED,
    isUrgent: true,
    totalFee: 260,
    urgentFee: 60,
    routeId: 'route-b',
    items: [
      { name: '高级西装', quantity: 1, unitPrice: 100 },
      { name: '真丝衬衫', quantity: 3, unitPrice: 40 }
    ],
    changes: [
      {
        id: uuidv4(),
        type: 'urgent',
        operatorId: 'dispatcher1',
        operatorName: '调度员小王',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        oldValue: { isUrgent: false, totalFee: 200, urgentFee: 0, estimatedDelivery: new Date(Date.now() + 86400000 * 2).toISOString() },
        newValue: { isUrgent: true, totalFee: 260, urgentFee: 60, estimatedDelivery: new Date(Date.now() + 86400000).toISOString() },
        reason: '客户要求第二天送达'
      }
    ],
    defects: [],
    batchNo: 'BATCH003'
  },
  {
    id: 'ORD004',
    customerName: '王芳',
    phone: '13700137003',
    address: '碧水湾15号楼2单元1001',
    area: '碧水湾',
    orderTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    estimatedDelivery: new Date(Date.now() + 86400000).toISOString(),
    status: StatusEnum.PICKED_UP,
    isUrgent: false,
    totalFee: 80,
    urgentFee: 0,
    routeId: 'route-c',
    items: [
      { name: '大衣', quantity: 1, unitPrice: 50 },
      { name: '毛衣', quantity: 2, unitPrice: 15 }
    ],
    changes: [
      {
        id: uuidv4(),
        type: 'route',
        operatorId: 'dispatcher2',
        operatorName: '调度员小李',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        oldValue: { routeId: null, routeName: null },
        newValue: { routeId: 'route-c', routeName: 'C区-住宅区' },
        reason: '自动分配路线'
      }
    ],
    defects: [],
    batchNo: 'BATCH004'
  },
  {
    id: 'ORD005',
    customerName: '赵强',
    phone: '13600136004',
    address: '阳光花园3号楼1单元502',
    area: '阳光花园',
    orderTime: new Date(Date.now() - 86400000 * 3).toISOString(),
    estimatedDelivery: new Date(Date.now() + 86400000).toISOString(),
    status: StatusEnum.WASHED,
    isUrgent: false,
    totalFee: 150,
    urgentFee: 0,
    routeId: 'route-c',
    items: [
      { name: '西装套装', quantity: 1, unitPrice: 80 },
      { name: '衬衫', quantity: 5, unitPrice: 10 },
      { name: '领带', quantity: 2, unitPrice: 10 }
    ],
    changes: [
      {
        id: uuidv4(),
        type: 'address',
        operatorId: 'dispatcher1',
        operatorName: '调度员小王',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        oldValue: { address: '幸福小区5号楼3单元201', area: '幸福小区', routeId: 'route-c', routeName: 'C区-住宅区' },
        newValue: { address: '阳光花园3号楼1单元502', area: '阳光花园', routeId: 'route-c', routeName: 'C区-住宅区' },
        reason: '客户送前改址，路线未变'
      }
    ],
    defects: [],
    batchNo: 'BATCH005'
  },
  {
    id: 'ORD006',
    customerName: '孙丽',
    phone: '13500135005',
    address: '西城区金融街5号',
    area: '西城区',
    orderTime: new Date(Date.now() - 86400000 * 4).toISOString(),
    estimatedDelivery: new Date(Date.now() - 86400000).toISOString(),
    status: StatusEnum.DISPUTE,
    isUrgent: false,
    totalFee: 200,
    urgentFee: 0,
    routeId: 'route-a',
    items: [
      { name: '真丝连衣裙', quantity: 2, unitPrice: 100 }
    ],
    changes: [],
    defects: [
      {
        id: uuidv4(),
        reportedBy: '王师傅',
        reportTime: new Date(Date.now() - 86400000).toISOString(),
        description: '取件时发现其中一条连衣裙腰部有轻微磨损痕迹',
        status: 'pending',
        images: []
      }
    ],
    batchNo: 'BATCH006'
  },
  {
    id: 'ORD007',
    customerName: '周杰',
    phone: '13400134006',
    address: '软件园A区3号楼',
    area: '软件园',
    orderTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    estimatedDelivery: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: StatusEnum.DELIVERED,
    isUrgent: true,
    totalFee: 330,
    urgentFee: 80,
    routeId: 'route-b',
    items: [
      { name: '羽绒服', quantity: 2, unitPrice: 80 },
      { name: '大衣', quantity: 1, unitPrice: 90 }
    ],
    changes: [
      {
        id: uuidv4(),
        type: 'route',
        operatorId: 'dispatcher1',
        operatorName: '调度员小王',
        timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
        oldValue: { routeId: null, routeName: null },
        newValue: { routeId: 'route-b', routeName: 'B区-科技园' },
        reason: '分配加急订单'
      },
      {
        id: uuidv4(),
        type: 'urgent',
        operatorId: 'dispatcher2',
        operatorName: '调度员小李',
        timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
        oldValue: { isUrgent: false, totalFee: 250, urgentFee: 0, estimatedDelivery: new Date(Date.now() - 86400000 * 1).toISOString() },
        newValue: { isUrgent: true, totalFee: 330, urgentFee: 80, estimatedDelivery: new Date(Date.now() - 86400000 * 2).toISOString() },
        reason: '客户加急处理'
      }
    ],
    defects: [],
    batchNo: 'BATCH007'
  }
];

const addressChangeRequests = [
  {
    id: uuidv4(),
    orderId: 'ORD005',
    userId: 'customer',
    userName: '赵强',
    oldAddress: '幸福小区5号楼3单元201',
    oldArea: '幸福小区',
    newAddress: '阳光花园3号楼1单元502',
    newArea: '阳光花园',
    requestTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'approved',
    approvedBy: 'dispatcher1',
    approvedByName: '调度员小王',
    approveTime: new Date(Date.now() - 86400000 * 2 + 1800000).toISOString(),
    routeChanged: false,
    reason: '客户搬家'
  }
];

module.exports = {
  StatusEnum,
  routes,
  users,
  orders,
  addressChangeRequests
};
