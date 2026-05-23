module.exports = {
  port: process.env.PORT || 3000,
  serviceTypes: ['标准洗', '精洗', '打蜡', '内饰清洁', '镀膜'],
  queueStatuses: ['等待中', '服务中', '已完成', '已过号', '已取消'],
  appointmentStatuses: ['待确认', '已确认', '已取消', '已完成'],
  stationStatuses: ['空闲', '忙碌', '维护中'],
  maxQueueNumber: 999,
  overnumberWaitCount: 3
};
