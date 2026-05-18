const moment = require('moment');

const testDrives = [
  {
    testDriveNo: 'TD-20250518-0001',
    customerName: '张三',
    customerPhone: '13800138001',
    customerIdCard: '110101199001011234',
    customerDriverLicense: '110101199001011234',
    salesConsultant: '销售顾问A',
    vehicleModel: '特斯拉Model 3',
    vehiclePlateNumber: '京A12345',
    vehicleVin: '5YJ3E1EA7JF000001',
    plannedRoute: '4S店-人民路-中山路-返回4S店',
    startTime: moment().subtract(2, 'hours').toDate(),
    endTime: moment().subtract(1, 'hours').toDate(),
    startMileage: 1500.5,
    endMileage: 1530.2,
    status: 'completed',
    hasAccident: false
  },
  {
    testDriveNo: 'TD-20250518-0002',
    customerName: '李四',
    customerPhone: '13800138002',
    customerIdCard: '110101199002025678',
    customerDriverLicense: '110101199002025678',
    salesConsultant: '销售顾问B',
    vehicleModel: '宝马X5',
    vehiclePlateNumber: '京B67890',
    vehicleVin: 'WBAKR010X0J000002',
    plannedRoute: '4S店-环城路-开发区-返回4S店',
    startTime: moment().subtract(26, 'hours').toDate(),
    endTime: moment().subtract(24, 'hours').toDate(),
    startMileage: 2800.0,
    endMileage: 2845.5,
    status: 'completed',
    hasAccident: false
  },
  {
    testDriveNo: 'TD-20250518-0003',
    customerName: '王五',
    customerPhone: '13800138003',
    customerIdCard: '110101199003039012',
    customerDriverLicense: '110101199003039012',
    salesConsultant: '销售顾问C',
    vehicleModel: '奔驰E300L',
    vehiclePlateNumber: '京C11111',
    vehicleVin: 'WDDZF4JB5KA000003',
    plannedRoute: '4S店-主干道-商圈-返回4S店',
    startTime: moment().subtract(75, 'hours').toDate(),
    endTime: moment().subtract(73, 'hours').toDate(),
    startMileage: 890.3,
    endMileage: 925.8,
    status: 'completed',
    hasAccident: false
  },
  {
    testDriveNo: 'TD-20250518-0004',
    customerName: '赵六',
    customerPhone: '13800138004',
    customerIdCard: '110101199004043456',
    customerDriverLicense: '110101199004043456',
    salesConsultant: '销售顾问A',
    vehicleModel: '奥迪A6L',
    vehiclePlateNumber: '京D22222',
    vehicleVin: 'WAUZZZF4XKN000004',
    plannedRoute: '4S店-快速路-郊区-返回4S店',
    startTime: moment().subtract(4, 'days').toDate(),
    endTime: moment().subtract(4, 'days').add(2, 'hours').toDate(),
    startMileage: 3200.0,
    endMileage: 3260.5,
    status: 'completed',
    hasAccident: false
  },
  {
    testDriveNo: 'TD-20250518-0005',
    customerName: '钱七',
    customerPhone: '13800138005',
    salesConsultant: '销售顾问B',
    vehicleModel: '本田雅阁',
    vehiclePlateNumber: '京E33333',
    startTime: moment().subtract(30, 'minutes').toDate(),
    status: 'in_progress',
    hasAccident: false
  }
];

const normalAccidentCase = {
  testDriveIndex: 0,
  accidentData: {
    reporterName: '张三',
    reporterPhone: '13800138001',
    reporterRole: 'customer',
    accidentTime: moment().subtract(1.5, 'hours').toDate(),
    accidentLocation: '中山路与人民路交叉口',
    accidentType: 'collision',
    accidentSeverity: 'minor',
    accidentDescription: '试驾过程中与右转弯车辆发生轻微碰撞，车辆右前保险杠刮擦，无人员受伤',
    weatherCondition: '晴',
    roadCondition: '干燥沥青路面',
    driverName: '张三',
    passengerCount: 2,
    hasInjury: false,
    vehicleDamage: '右前保险杠刮擦、右前雾灯罩破裂',
    otherVehicleDamage: '对方车辆左后保险杠轻微凹陷',
    propertyDamage: '无',
    policeCalled: false,
    insuranceCalled: true,
    insuranceReportNo: 'PA202505180001',
    photos: ['photo1.jpg', 'photo2.jpg'],
    estimatedLoss: 2500.00,
    liability: 'third_party'
  }
};

const conflictCases = [
  {
    name: '试驾结束后超时补报（超过24小时可信窗口）',
    testDriveIndex: 2,
    accidentData: {
      reporterName: '王五',
      reporterPhone: '13800138003',
      reporterRole: 'customer',
      accidentTime: moment().subtract(30, 'hours').toDate(),
      accidentLocation: '商圈停车场出口',
      accidentType: 'scratch',
      accidentSeverity: 'minor',
      accidentDescription: '试驾结束后第二天发现车辆左后门有刮擦痕迹，疑似试驾结束后停车时造成',
      weatherCondition: '多云',
      roadCondition: '停车场水泥路面',
      driverName: '王五',
      passengerCount: 1,
      hasInjury: false,
      vehicleDamage: '左后门约20cm刮擦痕迹',
      policeCalled: false,
      insuranceCalled: false,
      estimatedLoss: 800.00,
      liability: 'customer'
    },
    expectedStatus: 'pending_processing',
    expectedWarnings: ['ACCIDENT_TIME_AFTER_TESTDRIVE_SUSPICIOUS']
  },
  {
    name: '同一次试驾重复登记（存在潜在重复记录）',
    testDriveIndex: 0,
    accidentData: {
      reporterName: '销售顾问A',
      reporterPhone: '13900139001',
      reporterRole: 'sales',
      accidentTime: moment().subtract(1.5, 'hours').toDate(),
      accidentLocation: '中山路与人民路交叉口',
      accidentType: 'collision',
      accidentSeverity: 'minor',
      accidentDescription: '试驾车辆与其他车辆发生碰撞',
      driverName: '张三',
      passengerCount: 2,
      hasInjury: false,
      vehicleDamage: '右前保险杠损坏',
      policeCalled: false,
      insuranceCalled: true,
      insuranceReportNo: 'PA202505180002'
    },
    expectedStatus: 'pending_processing',
    expectedWarnings: ['POTENTIAL_DUPLICATE']
  },
  {
    name: '事故时间早于试驾开始时间（逻辑错误）',
    testDriveIndex: 0,
    accidentData: {
      reporterName: '张三',
      reporterPhone: '13800138001',
      reporterRole: 'customer',
      accidentTime: moment().subtract(3, 'hours').toDate(),
      accidentLocation: '4S店门口',
      accidentType: 'collision',
      accidentSeverity: 'minor',
      accidentDescription: '试驾前挪车时发生碰撞',
      driverName: '张三',
      hasInjury: false,
      vehicleDamage: '前保险杠损坏'
    },
    expectedStatus: 'rejected',
    expectedErrors: ['ACCIDENT_TIME_BEFORE_TESTDRIVE']
  },
  {
    name: '驾驶员与试驾客户不一致（需人工核实）',
    testDriveIndex: 1,
    accidentData: {
      reporterName: '李四',
      reporterPhone: '13800138002',
      reporterRole: 'customer',
      accidentTime: moment().subtract(25, 'hours').toDate(),
      accidentLocation: '环城路中段',
      accidentType: 'scratch',
      accidentSeverity: 'minor',
      accidentDescription: '试驾过程中路过路边障碍物时发生刮擦，实际驾驶员为李四朋友',
      weatherCondition: '晴',
      roadCondition: '干燥沥青路面',
      driverName: '王朋友',
      passengerCount: 3,
      hasInjury: false,
      vehicleDamage: '右侧两门刮擦',
      policeCalled: false,
      insuranceCalled: true,
      insuranceReportNo: 'PA202505170001',
      estimatedLoss: 3000.00,
      liability: 'customer'
    },
    expectedStatus: 'pending_review',
    expectedWarnings: ['DRIVER_MISMATCH']
  },
  {
    name: '事故时间晚于报案时间（逻辑错误）',
    testDriveIndex: 1,
    accidentData: {
      reporterName: '李四',
      reporterPhone: '13800138002',
      reporterRole: 'customer',
      accidentTime: moment().subtract(20, 'hours').toDate(),
      reportTime: moment().subtract(22, 'hours').toDate(),
      accidentLocation: '开发区路口',
      accidentType: 'collision',
      accidentSeverity: 'moderate',
      accidentDescription: '路口与电动车发生碰撞',
      driverName: '李四',
      hasInjury: true,
      injuryDescription: '电动车主轻微擦伤，已送医院检查'
    },
    expectedStatus: 'rejected',
    expectedErrors: ['ACCIDENT_TIME_AFTER_REPORT']
  }
];

module.exports = {
  testDrives,
  normalAccidentCase,
  conflictCases
};
