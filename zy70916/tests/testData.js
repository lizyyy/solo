const elderlyProfiles = [
  {
    elderly_id: 'E001',
    name: '张爷爷',
    gender: '男',
    age: 78,
    phone: '13800138001',
    address: '北京市朝阳区建国路88号',
    district: '朝阳区',
    health_status: '高血压、糖尿病',
    care_level: '三级护理',
    requirements: '需要定期测量血压血糖'
  },
  {
    elderly_id: 'E002',
    name: '李奶奶',
    gender: '女',
    age: 82,
    phone: '13800138002',
    address: '北京市海淀区中关村大街1号',
    district: '海淀区',
    health_status: '脑卒中后遗症',
    care_level: '二级护理',
    requirements: '需要肢体康复训练'
  },
  {
    elderly_id: 'E003',
    name: '王爷爷',
    gender: '男',
    age: 85,
    phone: '13800138003',
    address: '北京市西城区金融街15号',
    district: '西城区',
    health_status: '长期卧床、压疮',
    care_level: '一级护理',
    requirements: '需要压疮护理和换药'
  },
  {
    elderly_id: 'E004',
    name: '赵奶奶',
    gender: '女',
    age: 76,
    phone: '13800138004',
    address: '北京市朝阳区望京SOHO',
    district: '朝阳区',
    health_status: '行动不便',
    care_level: '三级护理',
    requirements: '需要生活照料'
  },
  {
    elderly_id: 'E005',
    name: '刘爷爷',
    gender: '男',
    age: 80,
    phone: '13800138005',
    address: '北京市东城区东长安街1号',
    district: '东城区',
    health_status: '失语、吞咽困难',
    care_level: '二级护理',
    requirements: '需要言语和吞咽训练'
  }
];

const nurseCalendars = [
  {
    nurse_id: 'N001',
    name: '王护士',
    gender: '女',
    phone: '13900139001',
    qualifications: '主管护师',
    skills: ['血压测量', '血糖监测', '生活照料', '清洁卫生'],
    district: '朝阳区',
    calendar: [
      { date: '2024-05-22', time_slot: '09:00-12:00', status: 'available' },
      { date: '2024-05-22', time_slot: '14:00-17:00', status: 'available' },
      { date: '2024-05-23', time_slot: '09:00-12:00', status: 'available' }
    ]
  },
  {
    nurse_id: 'N002',
    name: '李护士',
    gender: '女',
    phone: '13900139002',
    qualifications: '护师',
    skills: ['肢体康复', '理疗', '言语训练', '吞咽训练'],
    district: '海淀区',
    calendar: [
      { date: '2024-05-22', time_slot: '09:00-12:00', status: 'available' },
      { date: '2024-05-22', time_slot: '14:00-17:00', status: 'available' },
      { date: '2024-05-23', time_slot: '09:00-12:00', status: 'available' }
    ]
  },
  {
    nurse_id: 'N003',
    name: '张护士',
    gender: '男',
    phone: '13900139003',
    qualifications: '护士',
    skills: ['压疮护理', '换药', '生活照料'],
    district: '西城区',
    calendar: [
      { date: '2024-05-22', time_slot: '09:00-12:00', status: 'available' },
      { date: '2024-05-22', time_slot: '14:00-17:00', status: 'available' }
    ]
  }
];

module.exports = {
  elderlyProfiles,
  nurseCalendars
};
