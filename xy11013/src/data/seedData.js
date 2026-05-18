const { MedicationHandover } = require('../models/MedicationHandover');

const seedData = [];

const normalRecord1 = new MedicationHandover({
  id: 'MH-2024-001',
  elderlyInfo: {
    name: '张三',
    idCard: '310101193501011234',
    roomNumber: '302',
    bedNumber: 'A',
    primaryDisease: '高血压、2型糖尿病',
    allergies: ['青霉素', '磺胺类']
  },
  medication: {
    name: '硝苯地平缓释片',
    specification: '10mg/片',
    dosage: '1片',
    frequency: '每日2次',
    route: '口服',
    prescribedDosage: '1片',
    actualDosage: '1片'
  },
  doctorsOrder: {
    doctorName: '王医生',
    orderDate: '2024-05-10T09:00:00.000Z',
    remarks: '早晚餐后服用'
  },
  familyChange: {
    hasChange: false
  },
  nurseConfirmation: {
    hasConfirmed: true,
    confirmTime: '2024-05-10T09:30:00.000Z',
    nurseName: '李护士',
    nurseSignature: '李华'
  },
  medicationRecords: [
    {
      time: '2024-05-10T08:00:00.000Z',
      dosage: '1片',
      administeredBy: '李护士',
      notes: '正常服用'
    },
    {
      time: '2024-05-10T20:00:00.000Z',
      dosage: '1片',
      administeredBy: '王护士',
      notes: '正常服用'
    }
  ],
  handoverInfo: {
    handoverTime: '2024-05-11T08:00:00.000Z',
    fromNurse: '李护士',
    toNurse: '张护士',
    handoverRemarks: '老人服药依从性良好，无不良反应'
  }
});
normalRecord1.process();
seedData.push(normalRecord1);

const normalRecord2 = new MedicationHandover({
  id: 'MH-2024-002',
  elderlyInfo: {
    name: '李四',
    idCard: '310101193802025678',
    roomNumber: '205',
    bedNumber: 'B',
    primaryDisease: '冠心病、骨质疏松',
    allergies: []
  },
  medication: {
    name: '阿司匹林肠溶片',
    specification: '100mg/片',
    dosage: '1片',
    frequency: '每日1次',
    route: '口服',
    prescribedDosage: '1片',
    actualDosage: '1片'
  },
  doctorsOrder: {
    doctorName: '赵医生',
    orderDate: '2024-05-11T08:00:00.000Z',
    remarks: '早餐后服用'
  },
  familyChange: {
    hasChange: false
  },
  nurseConfirmation: {
    hasConfirmed: true,
    confirmTime: '2024-05-11T08:30:00.000Z',
    nurseName: '王护士',
    nurseSignature: '王丽'
  },
  medicationRecords: [
    {
      time: '2024-05-11T09:00:00.000Z',
      dosage: '1片',
      administeredBy: '王护士',
      notes: '正常服用'
    }
  ],
  handoverInfo: {
    handoverTime: '2024-05-12T08:00:00.000Z',
    fromNurse: '王护士',
    toNurse: '刘护士',
    handoverRemarks: '正常交接'
  }
});
normalRecord2.process();
seedData.push(normalRecord2);

const abnormalFamilyChangeUnconfirmed = new MedicationHandover({
  id: 'MH-2024-003',
  elderlyInfo: {
    name: '王五',
    idCard: '310101194003039012',
    roomNumber: '401',
    bedNumber: 'C',
    primaryDisease: '高血压、冠心病、脑梗塞后遗症',
    allergies: ['海鲜']
  },
  medication: {
    name: '苯磺酸氨氯地平片',
    specification: '5mg/片',
    dosage: '1片',
    frequency: '每日1次',
    route: '口服',
    prescribedDosage: '1片',
    actualDosage: '半片'
  },
  doctorsOrder: {
    doctorName: '陈医生',
    orderDate: '2024-05-08T10:00:00.000Z',
    remarks: '晨起服用'
  },
  familyChange: {
    hasChange: true,
    changeTime: '2024-05-10T14:30:00.000Z',
    familyMemberName: '王小妹（女儿）',
    familyMemberPhone: '13800138000',
    changedDosage: '半片',
    changeReason: '老人近期血压偏低，家属临时要求减量'
  },
  nurseConfirmation: {
    hasConfirmed: false,
    nurseName: '张护士'
  },
  medicationRecords: [
    {
      time: '2024-05-08T07:00:00.000Z',
      dosage: '1片',
      administeredBy: '张护士',
      notes: '正常服用'
    },
    {
      time: '2024-05-09T07:00:00.000Z',
      dosage: '1片',
      administeredBy: '张护士',
      notes: '正常服用'
    }
  ],
  handoverInfo: {
    handoverTime: '2024-05-11T08:00:00.000Z',
    fromNurse: '张护士',
    toNurse: '李护士',
    handoverRemarks: '注意：家属有剂量变更申请，待确认'
  }
});
abnormalFamilyChangeUnconfirmed.process();
seedData.push(abnormalFamilyChangeUnconfirmed);

const abnormalDosageInconsistency = new MedicationHandover({
  id: 'MH-2024-004',
  elderlyInfo: {
    name: '赵六',
    idCard: '310101193704043456',
    roomNumber: '103',
    bedNumber: 'D',
    primaryDisease: '2型糖尿病、高血脂',
    allergies: []
  },
  medication: {
    name: '盐酸二甲双胍片',
    specification: '0.5g/片',
    dosage: '1片',
    frequency: '每日3次',
    route: '口服',
    prescribedDosage: '1片',
    actualDosage: '2片'
  },
  doctorsOrder: {
    doctorName: '孙医生',
    orderDate: '2024-05-05T09:00:00.000Z',
    remarks: '三餐后服用'
  },
  familyChange: {
    hasChange: false
  },
  nurseConfirmation: {
    hasConfirmed: true,
    confirmTime: '2024-05-10T08:30:00.000Z',
    nurseName: '刘护士',
    nurseSignature: '刘芳'
  },
  medicationRecords: [
    {
      time: '2024-05-10T08:00:00.000Z',
      dosage: '1片',
      administeredBy: '刘护士',
      notes: '正常服用'
    },
    {
      time: '2024-05-10T12:00:00.000Z',
      dosage: '1片',
      administeredBy: '刘护士',
      notes: '正常服用'
    },
    {
      time: '2024-05-10T18:00:00.000Z',
      dosage: '1片',
      administeredBy: '周护士',
      notes: '正常服用'
    }
  ],
  handoverInfo: {
    handoverTime: '2024-05-11T08:00:00.000Z',
    fromNurse: '刘护士',
    toNurse: '周护士',
    handoverRemarks: '血糖控制良好'
  }
});
abnormalDosageInconsistency.process();
seedData.push(abnormalDosageInconsistency);

const abnormalCombinedIssues = new MedicationHandover({
  id: 'MH-2024-005',
  elderlyInfo: {
    name: '孙七',
    idCard: '310101193905057890',
    roomNumber: '502',
    bedNumber: 'E',
    primaryDisease: '帕金森病、高血压、前列腺增生',
    allergies: ['庆大霉素']
  },
  medication: {
    name: '美多芭（多巴丝肼片）',
    specification: '0.25g/片',
    dosage: '半片',
    frequency: '每日4次',
    route: '口服',
    prescribedDosage: '半片',
    actualDosage: '1片'
  },
  doctorsOrder: {
    doctorName: '周医生',
    orderDate: '2024-05-01T10:00:00.000Z',
    remarks: '饭前1小时服用'
  },
  familyChange: {
    hasChange: true,
    changeTime: '2024-05-09T16:00:00.000Z',
    familyMemberName: '孙建国（儿子）',
    familyMemberPhone: '13900139000',
    changedDosage: '1片',
    changeReason: '老人手抖症状加重，请求增加剂量'
  },
  nurseConfirmation: {
    hasConfirmed: false,
    nurseName: '吴护士'
  },
  medicationRecords: [
    {
      time: '2024-05-09T07:00:00.000Z',
      dosage: '半片',
      administeredBy: '吴护士',
      notes: '正常服用'
    },
    {
      time: '2024-05-09T11:00:00.000Z',
      dosage: '半片',
      administeredBy: '吴护士',
      notes: '正常服用'
    }
  ],
  handoverInfo: {
    handoverTime: '2024-05-10T08:00:00.000Z',
    fromNurse: '吴护士',
    toNurse: '郑护士',
    handoverRemarks: '待处理事项较多，请仔细核对'
  }
});
abnormalCombinedIssues.process();
seedData.push(abnormalCombinedIssues);

module.exports = seedData;
