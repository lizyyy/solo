const { STATION_STATUS } = require('./models');

let temporaryStops = [
  {
    id: 'TS001',
    lineId: 'L001',
    lineName: '张江线',
    stopName: '金科路地铁站',
    stopAddress: '上海市浦东新区金科路地铁站2号口',
    scheduledDate: '2026-05-20',
    scheduledTime: '08:15',
    direction: '上班',
    applicantName: '张三',
    applicantPhone: '13500135001',
    applicantDepartment: '研发部',
    storeId: 'S001',
    storeName: '上海总部',
    managerId: 'M001',
    managerName: '陈明',
    passengerCount: 12,
    reason: '新项目组入驻，员工通勤需求',
    status: STATION_STATUS.PENDING,
    remark: '',
    createdAt: '2026-05-15T10:30:00',
    reviewedAt: null,
    reviewer: null
  },
  {
    id: 'TS002',
    lineId: 'L001',
    lineName: '张江线',
    stopName: '广兰路地铁站',
    stopAddress: '上海市浦东新区广兰路地铁站1号口',
    scheduledDate: '2026-05-20',
    scheduledTime: '08:25',
    direction: '上班',
    applicantName: '李四',
    applicantPhone: '13500135002',
    applicantDepartment: '产品部',
    storeId: 'S001',
    storeName: '上海总部',
    managerId: 'M001',
    managerName: '陈明',
    passengerCount: 8,
    reason: '团队扩招，新增员工通勤',
    status: STATION_STATUS.APPROVED,
    remark: '已与司机确认',
    createdAt: '2026-05-14T14:20:00',
    reviewedAt: '2026-05-15T09:00:00',
    reviewer: '王总'
  },
  {
    id: 'TS003',
    lineId: 'L002',
    lineName: '漕河泾线',
    stopName: '漕河泾开发区站',
    stopAddress: '上海市徐汇区漕河泾开发区地铁站',
    scheduledDate: '2026-05-21',
    scheduledTime: '18:30',
    direction: '下班',
    applicantName: '王五',
    applicantPhone: '13500135003',
    applicantDepartment: '市场部',
    storeId: 'S002',
    storeName: '漕河泾分店',
    managerId: 'M002',
    managerName: '刘丽',
    passengerCount: 15,
    reason: '市场活动结束后员工返程',
    status: STATION_STATUS.REJECTED,
    remark: '该时段已有安排，建议调整时间',
    createdAt: '2026-05-13T16:45:00',
    reviewedAt: '2026-05-14T10:30:00',
    reviewer: '李总'
  },
  {
    id: 'TS004',
    lineId: 'L003',
    lineName: '莘庄线',
    stopName: '莘庄地铁站北广场',
    stopAddress: '上海市闵行区莘庄地铁站北广场',
    scheduledDate: '2026-05-22',
    scheduledTime: '07:45',
    direction: '上班',
    applicantName: '赵六',
    applicantPhone: '13500135004',
    applicantDepartment: '财务部',
    storeId: 'S003',
    storeName: '莘庄分店',
    managerId: 'M003',
    managerName: '周伟',
    passengerCount: 5,
    reason: '财务部培训，员工集中通勤',
    status: STATION_STATUS.APPROVED,
    remark: '',
    createdAt: '2026-05-16T09:15:00',
    reviewedAt: '2026-05-16T11:00:00',
    reviewer: '周伟'
  },
  {
    id: 'TS005',
    lineId: 'L004',
    lineName: '嘉定线',
    stopName: '嘉定新城站',
    stopAddress: '上海市嘉定区嘉定新城地铁站',
    scheduledDate: '2026-05-23',
    scheduledTime: '18:00',
    direction: '下班',
    applicantName: '孙七',
    applicantPhone: '13500135005',
    applicantDepartment: '运营部',
    storeId: 'S004',
    storeName: '嘉定分店',
    managerId: 'M003',
    managerName: '周伟',
    passengerCount: 20,
    reason: '运营团队团建返程',
    status: STATION_STATUS.PENDING,
    remark: '',
    createdAt: '2026-05-17T13:30:00',
    reviewedAt: null,
    reviewer: null
  }
];

let nextId = 6;

const getNextId = () => {
  return `TS${String(nextId++).padStart(3, '0')}`;
};

const getAllStops = () => temporaryStops;

const addStop = (stop) => {
  const newStop = {
    id: getNextId(),
    ...stop,
    status: STATION_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewer: null
  };
  temporaryStops.push(newStop);
  return newStop;
};

const updateStop = (id, updates) => {
  const index = temporaryStops.findIndex(s => s.id === id);
  if (index === -1) return null;
  temporaryStops[index] = { ...temporaryStops[index], ...updates };
  return temporaryStops[index];
};

const getStopById = (id) => temporaryStops.find(s => s.id === id);

const deleteStop = (id) => {
  const index = temporaryStops.findIndex(s => s.id === id);
  if (index === -1) return false;
  temporaryStops.splice(index, 1);
  return true;
};

module.exports = {
  getAllStops,
  addStop,
  updateStop,
  getStopById,
  deleteStop
};
