const storage = require('../utils/storage');

const sampleVolunteers = [
  {
    id: 'V001',
    name: '张秀英',
    idCard: '110101196501011234',
    phone: '13800138001',
    community: '幸福街道和平社区',
    gender: '女',
    age: 59,
    registerDate: '2023-01-15',
    status: 'active'
  },
  {
    id: 'V002',
    name: '李建国',
    idCard: '110101196005055678',
    phone: '13800138002',
    community: '幸福街道和平社区',
    gender: '男',
    age: 64,
    registerDate: '2023-02-20',
    status: 'active'
  },
  {
    id: 'V003',
    name: '王美玲',
    idCard: '110101197010109012',
    phone: '13800138003',
    community: '阳光街道阳光社区',
    gender: '女',
    age: 54,
    registerDate: '2023-03-10',
    status: 'active'
  }
];

const sampleRecords = [
  {
    id: 'R001',
    volunteerId: 'V001',
    volunteerName: '张秀英',
    serviceDate: '2024-05-01',
    serviceProject: '社区环境清洁',
    serviceLocation: '和平小区1-5号楼',
    startTime: '09:00',
    endTime: '12:00',
    serviceHours: 3,
    checkInMethod: 'face',
    checkInStatus: 'normal',
    witness: '赵主任',
    evidenceId: 'EVID20240501001',
    publicityStatus: 'publicized',
    publicityDate: '2024-05-02',
    remarks: '劳动节志愿服务活动',
    isLateMakeup: false,
    isProxySign: false,
    createdBy: 'admin'
  },
  {
    id: 'R002',
    volunteerId: 'V001',
    volunteerName: '张秀英',
    serviceDate: '2024-05-10',
    serviceProject: '老年陪伴',
    serviceLocation: '社区养老服务中心',
    startTime: '14:00',
    endTime: '17:00',
    serviceHours: 3,
    checkInMethod: 'face',
    checkInStatus: 'normal',
    witness: '李社工',
    evidenceId: 'EVID20240510001',
    publicityStatus: 'publicized',
    publicityDate: '2024-05-11',
    remarks: '陪伴王奶奶聊天读报',
    isLateMakeup: false,
    isProxySign: false,
    createdBy: 'admin'
  },
  {
    id: 'R003',
    volunteerId: 'V002',
    volunteerName: '李建国',
    serviceDate: '2024-05-05',
    serviceProject: '政策宣传',
    serviceLocation: '社区活动广场',
    startTime: '08:30',
    endTime: '11:30',
    serviceHours: 3,
    checkInMethod: 'face',
    checkInStatus: 'normal',
    witness: '钱书记',
    evidenceId: 'EVID20240505001',
    publicityStatus: 'publicized',
    publicityDate: '2024-05-06',
    remarks: '社保政策宣传',
    isLateMakeup: false,
    isProxySign: false,
    createdBy: 'admin'
  },
  {
    id: 'R004',
    volunteerId: 'V003',
    volunteerName: '王美玲',
    serviceDate: '2024-05-08',
    serviceProject: '义务理发',
    serviceLocation: '社区便民服务站',
    startTime: '09:00',
    endTime: '16:00',
    serviceHours: 6,
    checkInMethod: 'face',
    checkInStatus: 'normal',
    witness: '孙站长',
    evidenceId: 'EVID20240508001',
    publicityStatus: 'pending',
    remarks: '学雷锋便民服务日活动',
    isLateMakeup: false,
    isProxySign: false,
    createdBy: 'admin'
  }
];

const conflictRecord = {
  volunteerId: 'V001',
  volunteerName: '张秀英',
  serviceDate: '2024-05-15',
  serviceProject: '图书整理',
  serviceLocation: '社区图书室',
  startTime: '09:00',
  endTime: '11:00',
  serviceHours: 2,
  checkInMethod: 'proxy',
  checkInStatus: 'proxy_sign',
  witness: '周管理',
  evidenceId: 'EVID20240515001',
  publicityStatus: 'pending',
  remarks: '代签同时标记迟到补签 - 冲突示例',
  isLateMakeup: true,
  isProxySign: true,
  proxySigner: '儿子代签',
  createdBy: 'operator'
};

const badImportRows = [
  {
    volunteerId: 'V001',
    volunteerName: '',
    serviceDate: '2024-05-20',
    serviceProject: '',
    serviceHours: 0
  },
  {
    volunteerId: '',
    serviceDate: '2024-05-21',
    serviceHours: -2
  },
  {
    isProxySign: true
  }
];

function initializeData() {
  const existingVolunteers = storage.getVolunteers();
  const existingRecords = storage.getRecords();

  if (existingVolunteers.length === 0) {
    sampleVolunteers.forEach(v => {
      v.createdAt = new Date().toISOString();
      v.updatedAt = new Date().toISOString();
      storage.addVolunteer(v);
    });
    console.log('✓ 志愿者初始化数据已加载');
  }

  if (existingRecords.length === 0) {
    sampleRecords.forEach(r => {
      r.createdAt = new Date().toISOString();
      r.updatedAt = new Date().toISOString();
      storage.addRecord(r);
    });
    console.log('✓ 服务记录初始化数据已加载');
  }

  console.log(`\n📊 当前数据统计:`);
  console.log(`   志愿者人数: ${storage.getVolunteers().length}`);
  console.log(`   服务记录数: ${storage.getRecords().length}`);
  
  return {
    conflictRecord,
    badImportRows
  };
}

module.exports = {
  initializeData,
  sampleVolunteers,
  sampleRecords,
  conflictRecord,
  badImportRows
};