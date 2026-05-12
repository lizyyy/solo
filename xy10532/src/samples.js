const SAMPLE_CASES = {
  outpatient_success: {
    id: 'OP-2025001',
    claimType: 'outpatient',
    claimant: {
      name: '张三',
      idCard: '110101199001011234',
      phone: '13800138001'
    },
    policy: {
      policyNumber: 'POL-2025-001',
      insuredAmount: 10000,
      insurer: '平安保险'
    },
    accidentDate: '2025-05-10',
    accidentLocation: '北京市朝阳区',
    diagnosis: '急性上呼吸道感染',
    materials: [
      {
        id: 'M001',
        name: '诊断证明书.pdf',
        type: 'DIAGNOSIS_CERTIFICATE',
        source: 'hospital',
        uploadDate: '2025-05-11',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M002',
        name: '门诊发票_0012345.pdf',
        type: 'OUTPATIENT_INVOICE',
        source: 'hospital',
        invoiceNumber: 'INV-OP-2025-0012345',
        amount: 328.50,
        uploadDate: '2025-05-11',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M003',
        name: '门诊费用清单_0012345.pdf',
        type: 'OUTPATIENT_LIST',
        source: 'hospital',
        invoiceNumber: 'INV-OP-2025-0012345',
        amount: 328.50,
        uploadDate: '2025-05-11',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M004',
        name: '门诊病历.pdf',
        type: 'MEDICAL_RECORD',
        source: 'customer',
        uploadDate: '2025-05-11',
        uploadedBy: '张三'
      }
    ],
    invoiceTotal: 328.50,
    expectedReimbursement: 262.80,
    status: 'IMPORTED',
    createdAt: '2025-05-11T09:00:00.000Z'
  },

  outpatient_missing: {
    id: 'OP-2025002',
    claimType: 'outpatient',
    claimant: {
      name: '李四',
      idCard: '110101199002022345',
      phone: '13800138002'
    },
    policy: {
      policyNumber: 'POL-2025-002',
      insuredAmount: 10000,
      insurer: '中国人寿'
    },
    accidentDate: '2025-05-09',
    accidentLocation: '北京市海淀区',
    diagnosis: '急性胃肠炎',
    materials: [
      {
        id: 'M005',
        name: '门诊发票_0012346.pdf',
        type: 'OUTPATIENT_INVOICE',
        source: 'hospital',
        invoiceNumber: 'INV-OP-2025-0012346',
        amount: 580.00,
        uploadDate: '2025-05-10',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M006',
        name: '门诊费用清单_0012346.pdf',
        type: 'OUTPATIENT_LIST',
        source: 'hospital',
        invoiceNumber: 'INV-OP-2025-0012346',
        amount: 580.00,
        uploadDate: '2025-05-10',
        uploadedBy: 'hospital_system'
      }
    ],
    invoiceTotal: 580.00,
    expectedReimbursement: 464.00,
    status: 'IMPORTED',
    createdAt: '2025-05-10T14:30:00.000Z'
  },

  outpatient_amount_issue: {
    id: 'OP-2025003',
    claimType: 'outpatient',
    claimant: {
      name: '王五',
      idCard: '110101199003033456',
      phone: '13800138003'
    },
    policy: {
      policyNumber: 'POL-2025-003',
      insuredAmount: 10000,
      insurer: '太平洋保险'
    },
    accidentDate: '2025-05-08',
    accidentLocation: '北京市西城区',
    diagnosis: '牙周炎',
    materials: [
      {
        id: 'M007',
        name: '诊断证明书.pdf',
        type: 'DIAGNOSIS_CERTIFICATE',
        source: 'hospital',
        uploadDate: '2025-05-09',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M008',
        name: '门诊发票_0012347.pdf',
        type: 'OUTPATIENT_INVOICE',
        source: 'hospital',
        invoiceNumber: 'INV-OP-2025-0012347',
        amount: 1250.00,
        uploadDate: '2025-05-09',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M009',
        name: '门诊费用清单_0012347.pdf',
        type: 'OUTPATIENT_LIST',
        source: 'hospital',
        invoiceNumber: 'INV-OP-2025-0012347',
        amount: 1150.00,
        uploadDate: '2025-05-09',
        uploadedBy: 'hospital_system'
      }
    ],
    invoiceTotal: 1250.00,
    expectedReimbursement: 1000.00,
    status: 'IMPORTED',
    createdAt: '2025-05-09T11:20:00.000Z'
  },

  inpatient_success: {
    id: 'IP-2025001',
    claimType: 'inpatient',
    claimant: {
      name: '赵六',
      idCard: '110101199004044567',
      phone: '13800138004'
    },
    policy: {
      policyNumber: 'POL-2025-004',
      insuredAmount: 50000,
      insurer: '平安保险'
    },
    accidentDate: '2025-05-01',
    accidentLocation: '上海市浦东新区',
    admissionDate: '2025-05-01',
    dischargeDate: '2025-05-07',
    hospital: '上海市第一人民医院',
    diagnosis: '急性阑尾炎',
    materials: [
      {
        id: 'M010',
        name: '出院小结.pdf',
        type: 'DISCHARGE_SUMMARY',
        source: 'hospital',
        uploadDate: '2025-05-08',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M011',
        name: '诊断证明书.pdf',
        type: 'DIAGNOSIS_CERTIFICATE',
        source: 'hospital',
        uploadDate: '2025-05-08',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M012',
        name: '住院发票_0056789.pdf',
        type: 'HOSPITAL_INVOICE',
        source: 'hospital',
        invoiceNumber: 'INV-HP-2025-0056789',
        amount: 12800.00,
        uploadDate: '2025-05-08',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M013',
        name: '住院费用清单_0056789.pdf',
        type: 'HOSPITAL_LIST',
        source: 'hospital',
        invoiceNumber: 'INV-HP-2025-0056789',
        amount: 12800.00,
        uploadDate: '2025-05-08',
        uploadedBy: 'hospital_system'
      }
    ],
    invoiceTotal: 12800.00,
    expectedReimbursement: 10240.00,
    status: 'IMPORTED',
    createdAt: '2025-05-08T16:00:00.000Z'
  },

  inpatient_duplicate: {
    id: 'IP-2025002',
    claimType: 'inpatient',
    claimant: {
      name: '孙七',
      idCard: '110101199005055678',
      phone: '13800138005'
    },
    policy: {
      policyNumber: 'POL-2025-005',
      insuredAmount: 50000,
      insurer: '中国人寿'
    },
    accidentDate: '2025-05-03',
    accidentLocation: '广东省广州市天河区',
    admissionDate: '2025-05-03',
    dischargeDate: '2025-05-10',
    hospital: '广州市第一人民医院',
    diagnosis: '肺炎',
    materials: [
      {
        id: 'M014',
        name: '出院小结.pdf',
        type: 'DISCHARGE_SUMMARY',
        source: 'hospital',
        uploadDate: '2025-05-11',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M015',
        name: '诊断证明书.pdf',
        type: 'DIAGNOSIS_CERTIFICATE',
        source: 'hospital',
        uploadDate: '2025-05-11',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M016',
        name: '住院发票_0056790.pdf',
        type: 'HOSPITAL_INVOICE',
        source: 'hospital',
        invoiceNumber: 'INV-HP-2025-0056790',
        amount: 18500.00,
        uploadDate: '2025-05-11',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M017',
        name: '住院发票_0056790_副本.pdf',
        type: 'HOSPITAL_INVOICE',
        source: 'customer',
        invoiceNumber: 'INV-HP-2025-0056790',
        amount: 18500.00,
        uploadDate: '2025-05-11',
        uploadedBy: '孙七'
      },
      {
        id: 'M018',
        name: '住院费用清单_0056790.pdf',
        type: 'HOSPITAL_LIST',
        source: 'hospital',
        invoiceNumber: 'INV-HP-2025-0056790',
        amount: 18500.00,
        uploadDate: '2025-05-11',
        uploadedBy: 'hospital_system'
      }
    ],
    invoiceTotal: 18500.00,
    expectedReimbursement: 14800.00,
    status: 'IMPORTED',
    createdAt: '2025-05-11T10:15:00.000Z'
  },

  traffic_accident_success: {
    id: 'TA-2025001',
    claimType: 'traffic_accident',
    claimant: {
      name: '周八',
      idCard: '110101199006066789',
      phone: '13800138006'
    },
    policy: {
      policyNumber: 'POL-2025-006',
      insuredAmount: 200000,
      insurer: '人保财险'
    },
    accidentDate: '2025-05-05',
    accidentLocation: '江苏省南京市鼓楼区中山路',
    accidentNumber: 'NJ-2025-0505-001',
    vehicleNumber: '苏A-12345',
    diagnosis: '右锁骨骨折、多处软组织挫伤',
    materials: [
      {
        id: 'M019',
        name: '交通事故认定书.pdf',
        type: 'TRAFFIC_ACCIDENT_RECOGNITION',
        source: 'police',
        uploadDate: '2025-05-06',
        uploadedBy: 'traffic_police'
      },
      {
        id: 'M020',
        name: '诊断证明书.pdf',
        type: 'DIAGNOSIS_CERTIFICATE',
        source: 'hospital',
        uploadDate: '2025-05-06',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M021',
        name: '门诊病历.pdf',
        type: 'MEDICAL_RECORD',
        source: 'hospital',
        uploadDate: '2025-05-06',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M022',
        name: '身份证_周八.pdf',
        type: 'IDENTITY_CARD',
        source: 'customer',
        uploadDate: '2025-05-06',
        uploadedBy: '周八'
      },
      {
        id: 'M023',
        name: '医疗发票_0089012.pdf',
        type: 'MEDICAL_INVOICE',
        source: 'hospital',
        invoiceNumber: 'INV-MED-2025-0089012',
        amount: 8500.00,
        uploadDate: '2025-05-06',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M024',
        name: '医疗费用清单_0089012.pdf',
        type: 'MEDICAL_LIST',
        source: 'hospital',
        invoiceNumber: 'INV-MED-2025-0089012',
        amount: 8500.00,
        uploadDate: '2025-05-06',
        uploadedBy: 'hospital_system'
      }
    ],
    invoiceTotal: 8500.00,
    expectedReimbursement: 6800.00,
    status: 'IMPORTED',
    createdAt: '2025-05-06T13:45:00.000Z'
  },

  traffic_accident_uncertain: {
    id: 'TA-2025002',
    claimType: 'traffic_accident',
    claimant: {
      name: '吴九',
      idCard: '110101199007077890',
      phone: '13800138007'
    },
    policy: {
      policyNumber: 'POL-2025-007',
      insuredAmount: 200000,
      insurer: '平安财险'
    },
    accidentDate: '2025-05-07',
    accidentLocation: '浙江省杭州市西湖区',
    accidentNumber: 'HZ-2025-0507-003',
    vehicleNumber: '浙A-67890',
    diagnosis: '左腿擦伤、轻微脑震荡',
    materials: [
      {
        id: 'M025',
        name: '交通事故认定书.pdf',
        type: 'TRAFFIC_ACCIDENT_RECOGNITION',
        source: 'police',
        uploadDate: '2025-05-08',
        uploadedBy: 'traffic_police'
      },
      {
        id: 'M026',
        name: '诊断证明书.pdf',
        type: 'DIAGNOSIS_CERTIFICATE',
        source: 'hospital',
        uploadDate: '2025-05-08',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M027',
        name: '扫描件_20250508_143022.pdf',
        type: 'UNCERTAIN',
        source: 'customer',
        uploadDate: '2025-05-08',
        uploadedBy: '吴九'
      },
      {
        id: 'M028',
        name: '照片_20250508_143025.jpg',
        type: 'UNCERTAIN',
        source: 'customer',
        uploadDate: '2025-05-08',
        uploadedBy: '吴九'
      },
      {
        id: 'M029',
        name: '身份证_吴九.pdf',
        type: 'IDENTITY_CARD',
        source: 'customer',
        uploadDate: '2025-05-08',
        uploadedBy: '吴九'
      },
      {
        id: 'M030',
        name: '医疗发票_0089013.pdf',
        type: 'MEDICAL_INVOICE',
        source: 'hospital',
        invoiceNumber: 'INV-MED-2025-0089013',
        amount: 3200.00,
        uploadDate: '2025-05-08',
        uploadedBy: 'hospital_system'
      },
      {
        id: 'M031',
        name: '医疗费用清单_0089013.pdf',
        type: 'MEDICAL_LIST',
        source: 'hospital',
        invoiceNumber: 'INV-MED-2025-0089013',
        amount: 3200.00,
        uploadDate: '2025-05-08',
        uploadedBy: 'hospital_system'
      }
    ],
    invoiceTotal: 3200.00,
    expectedReimbursement: 2560.00,
    status: 'IMPORTED',
    createdAt: '2025-05-08T14:30:00.000Z'
  }
};

module.exports = {
  SAMPLE_CASES,
  getAllSamples: () => Object.values(SAMPLE_CASES),
  getSampleById: (id) => SAMPLE_CASES[id],
  getSamplesByType: (type) => Object.values(SAMPLE_CASES).filter(c => c.claimType === type)
};
