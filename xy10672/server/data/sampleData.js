const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const flightData = [
  {
    id: 'F001',
    flightNo: 'CA1234',
    airline: '中国国航',
    departure: '北京首都',
    arrival: '上海浦东',
    scheduledTime: '2026-05-14 08:30:00',
    actualTime: '2026-05-14 08:45:00',
    status: 'delayed',
    gate: 'T2-25',
    updateTime: '2026-05-14 07:00:00'
  },
  {
    id: 'F002',
    flightNo: 'MU5678',
    airline: '东方航空',
    departure: '广州白云',
    arrival: '上海虹桥',
    scheduledTime: '2026-05-14 10:00:00',
    actualTime: '2026-05-14 10:00:00',
    status: 'on_time',
    gate: 'T1-12',
    updateTime: '2026-05-14 09:00:00'
  },
  {
    id: 'F003',
    flightNo: 'CZ9012',
    airline: '南方航空',
    departure: '深圳宝安',
    arrival: '北京大兴',
    scheduledTime: '2026-05-14 14:30:00',
    actualTime: '2026-05-14 15:00:00',
    status: 'delayed',
    gate: 'T3-45',
    updateTime: '2026-05-14 13:00:00'
  },
  {
    id: 'F004',
    flightNo: 'HU3456',
    airline: '海南航空',
    departure: '成都天府',
    arrival: '上海浦东',
    scheduledTime: '2026-05-14 16:00:00',
    actualTime: null,
    status: 'cancelled',
    gate: 'T2-18',
    updateTime: '2026-05-14 15:00:00'
  }
];

const driverData = [
  {
    id: 'D001',
    name: '张三',
    phone: '13800138001',
    licenseNo: '310101198001011234',
    vehicleId: 'V001',
    vehiclePlate: '沪A12345',
    vehicleModel: '别克GL8',
    status: 'available',
    rating: 4.8
  },
  {
    id: 'D002',
    name: '李四',
    phone: '13800138002',
    licenseNo: '310101198502022345',
    vehicleId: 'V002',
    vehiclePlate: '沪B67890',
    vehicleModel: '丰田埃尔法',
    status: 'on_trip',
    rating: 4.9
  },
  {
    id: 'D003',
    name: '王五',
    phone: '13800138003',
    licenseNo: '310101199003033456',
    vehicleId: 'V003',
    vehiclePlate: '沪C11111',
    vehicleModel: '奔驰V级',
    status: 'available',
    rating: 4.7
  },
  {
    id: 'D004',
    name: '赵六',
    phone: '13800138004',
    licenseNo: '310101198804044567',
    vehicleId: 'V004',
    vehiclePlate: '沪D22222',
    vehicleModel: '大众迈腾',
    status: 'offline',
    rating: 4.6
  }
];

const tripData = [
  {
    id: 'T001',
    orderNo: 'ORD20260514001',
    customerName: '王先生',
    customerPhone: '13900139001',
    flightNo: 'CA1234',
    flightId: 'F001',
    driverId: 'D001',
    vehicleId: 'V001',
    pickupAddress: '上海浦东机场T2航站楼',
    dropoffAddress: '上海市浦东新区陆家嘴金融中心',
    scheduledTime: '2026-05-14 09:30:00',
    actualArriveTime: null,
    actualPickupTime: null,
    status: 'pending',
    createTime: '2026-05-14 06:00:00'
  },
  {
    id: 'T002',
    orderNo: 'ORD20260514002',
    customerName: '李女士',
    customerPhone: '13900139002',
    flightNo: 'MU5678',
    flightId: 'F002',
    driverId: 'D002',
    vehicleId: 'V002',
    pickupAddress: '上海虹桥机场T1航站楼',
    dropoffAddress: '上海市静安区南京西路',
    scheduledTime: '2026-05-14 11:00:00',
    actualArriveTime: '2026-05-14 10:00:00',
    actualPickupTime: null,
    status: 'arrived',
    createTime: '2026-05-14 08:00:00'
  },
  {
    id: 'T003',
    orderNo: 'ORD20260514003',
    customerName: '张总',
    customerPhone: '13900139003',
    flightNo: 'CZ9012',
    flightId: 'F003',
    driverId: 'D003',
    vehicleId: 'V003',
    pickupAddress: '北京大兴机场',
    dropoffAddress: '北京市朝阳区国贸中心',
    scheduledTime: '2026-05-14 16:00:00',
    actualArriveTime: null,
    actualPickupTime: null,
    status: 'pending',
    createTime: '2026-05-14 10:00:00'
  }
];

const waitingFeeData = [
  {
    id: 'W001',
    tripId: 'T002',
    orderNo: 'ORD20260514002',
    arriveTime: '2026-05-14 10:00:00',
    pickupTime: '2026-05-14 10:45:00',
    waitingMinutes: 45,
    freeMinutes: 30,
    chargeMinutes: 15,
    ratePerMinute: 2,
    amount: 30,
    status: 'calculated',
    createTime: '2026-05-14 10:45:00',
    handler: '调度员A'
  }
];

const reassignData = [
  {
    id: 'R001',
    tripId: 'T001',
    orderNo: 'ORD20260514001',
    oldDriverId: 'D001',
    oldDriverName: '张三',
    newDriverId: 'D003',
    newDriverName: '王五',
    reason: '航班延误，原司机已有其他安排',
    status: 'completed',
    createTime: '2026-05-14 07:30:00',
    handler: '调度员B'
  }
];

const reviewData = [
  {
    id: 'REV001',
    tripId: 'T002',
    orderNo: 'ORD20260514002',
    customerName: '李女士',
    driverId: 'D002',
    driverName: '李四',
    rating: 5,
    comment: '司机服务非常好，准时接机，车内整洁',
    createTime: '2026-05-14 12:30:00'
  },
  {
    id: 'REV002',
    tripId: 'T001',
    orderNo: 'ORD20260514001',
    customerName: '王先生',
    driverId: 'D003',
    driverName: '王五',
    rating: 4,
    comment: '整体不错，就是等待时间有点长',
    createTime: '2026-05-14 11:00:00'
  }
];

const historyData = [
  {
    id: 'H001',
    type: 'flight_update',
    referenceId: 'F001',
    field: 'status',
    oldValue: 'on_time',
    newValue: 'delayed',
    handleTime: '2026-05-14 07:00:00',
    handler: '系统自动',
    remark: '航班动态更新'
  },
  {
    id: 'H002',
    type: 'flight_update',
    referenceId: 'F001',
    field: 'actualTime',
    oldValue: '2026-05-14 08:30:00',
    newValue: '2026-05-14 08:45:00',
    handleTime: '2026-05-14 07:00:00',
    handler: '系统自动',
    remark: '航班动态更新'
  },
  {
    id: 'H003',
    type: 'reassign',
    referenceId: 'R001',
    field: 'driverId',
    oldValue: 'D001',
    newValue: 'D003',
    handleTime: '2026-05-14 07:30:00',
    handler: '调度员B',
    remark: '改签重派'
  },
  {
    id: 'H004',
    type: 'trip_update',
    referenceId: 'T002',
    field: 'actualArriveTime',
    oldValue: null,
    newValue: '2026-05-14 10:00:00',
    handleTime: '2026-05-14 10:00:00',
    handler: '调度员A',
    remark: '司机到达机场'
  },
  {
    id: 'H005',
    type: 'waiting_fee',
    referenceId: 'W001',
    field: 'amount',
    oldValue: '0',
    newValue: '30',
    handleTime: '2026-05-14 10:45:00',
    handler: '调度员A',
    remark: '等待费用计算'
  }
];

module.exports = {
  flightData,
  driverData,
  tripData,
  waitingFeeData,
  reassignData,
  reviewData,
  historyData
};
