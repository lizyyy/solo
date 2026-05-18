const STATION_STATUS = {
  PENDING: '待复核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  CANCELLED: '已取消'
};

const SHUTTLE_LINES = [
  { lineId: 'L001', lineName: '张江线', capacity: 45, driver: '张师傅', driverPhone: '13800138001' },
  { lineId: 'L002', lineName: '漕河泾线', capacity: 40, driver: '李师傅', driverPhone: '13800138002' },
  { lineId: 'L003', lineName: '莘庄线', capacity: 35, driver: '王师傅', driverPhone: '13800138003' },
  { lineId: 'L004', lineName: '嘉定线', capacity: 50, driver: '赵师傅', driverPhone: '13800138004' }
];

const STORES = [
  { storeId: 'S001', storeName: '上海总部', address: '上海市浦东新区张江高科技园区' },
  { storeId: 'S002', storeName: '漕河泾分店', address: '上海市徐汇区漕河泾开发区' },
  { storeId: 'S003', storeName: '莘庄分店', address: '上海市闵行区莘庄商务区' },
  { storeId: 'S004', storeName: '嘉定分店', address: '上海市嘉定区嘉定新城' }
];

const MANAGERS = [
  { managerId: 'M001', managerName: '陈明', department: '行政部', phone: '13900139001' },
  { managerId: 'M002', managerName: '刘丽', department: '人力资源部', phone: '13900139002' },
  { managerId: 'M003', managerName: '周伟', department: '运营部', phone: '13900139003' }
];

module.exports = {
  STATION_STATUS,
  SHUTTLE_LINES,
  STORES,
  MANAGERS
};
