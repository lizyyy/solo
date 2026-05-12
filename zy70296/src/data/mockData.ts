import { Patient, Exam, FilmPickup, PrintRecord, ReprintRequest, AbnormalRecord, HistoryEntry } from '../types';

const now = new Date();
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

export const mockPatients: Patient[] = [
  {
    id: 'P001',
    name: '张三',
    gender: '男',
    age: 45,
    idCard: '110101197901011234',
    phone: '13800138001'
  },
  {
    id: 'P002',
    name: '李四',
    gender: '女',
    age: 32,
    idCard: '110101199202022345',
    phone: '13800138002'
  },
  {
    id: 'P003',
    name: '王五',
    gender: '男',
    age: 58,
    idCard: '110101196603033456',
    phone: '13800138003'
  },
  {
    id: 'P004',
    name: '赵六',
    gender: '女',
    age: 28,
    idCard: '110101199604044567',
    phone: '13800138004'
  }
];

export const mockExams: Exam[] = [
  {
    id: 'EX001',
    examNo: 'EX20260510001',
    examType: '胸部CT',
    examDate: '2026-05-10',
    examTime: '09:30',
    patientId: 'P001',
    patientName: '张三',
    department: '呼吸内科',
    attendingDoctor: '王医生',
    examResult: '双肺未见明显异常，心影大小正常',
    filmCount: 2,
    status: 'ready'
  },
  {
    id: 'EX002',
    examNo: 'EX20260511001',
    examType: '腰椎MRI',
    examDate: '2026-05-11',
    examTime: '14:00',
    patientId: 'P002',
    patientName: '李四',
    department: '骨科',
    attendingDoctor: '李医生',
    examResult: 'L4-L5椎间盘轻度突出',
    filmCount: 3,
    status: 'ready'
  },
  {
    id: 'EX003',
    examNo: 'EX20260509001',
    examType: '头颅CT',
    examDate: '2026-05-09',
    examTime: '10:00',
    patientId: 'P003',
    patientName: '王五',
    department: '神经内科',
    attendingDoctor: '张医生',
    examResult: '未见明显异常',
    filmCount: 2,
    status: 'printed'
  },
  {
    id: 'EX004',
    examNo: 'EX20260512001',
    examType: '腹部超声',
    examDate: '2026-05-12',
    examTime: '08:00',
    patientId: 'P004',
    patientName: '赵六',
    department: '消化内科',
    attendingDoctor: '赵医生',
    examResult: '肝、胆、胰、脾未见明显异常',
    filmCount: 1,
    status: 'pending'
  },
  {
    id: 'EX005',
    examNo: 'EX20260512002',
    examType: '膝关节X线',
    examDate: '2026-05-12',
    examTime: '11:00',
    patientId: 'P001',
    patientName: '张三',
    department: '骨科',
    attendingDoctor: '王医生',
    examResult: '左膝关节退行性改变',
    filmCount: 2,
    status: 'ready'
  }
];

export const mockFilmPickups: FilmPickup[] = [
  {
    id: 'FP001',
    pickupCode: '20260510-8876',
    examNo: 'EX20260510001',
    patientId: 'P001',
    patientName: '张三',
    createdAt: twoDaysAgo.toISOString(),
    expiresAt: tomorrow.toISOString(),
    status: 'active'
  },
  {
    id: 'FP002',
    pickupCode: '20260511-6543',
    examNo: 'EX20260511001',
    patientId: 'P002',
    patientName: '李四',
    createdAt: oneDayAgo.toISOString(),
    expiresAt: tomorrow.toISOString(),
    status: 'active'
  },
  {
    id: 'FP003',
    pickupCode: '20260509-9876',
    examNo: 'EX20260509001',
    patientId: 'P003',
    patientName: '王五',
    createdAt: twoDaysAgo.toISOString(),
    expiresAt: yesterday.toISOString(),
    status: 'used'
  },
  {
    id: 'FP004',
    pickupCode: '20260512-7654',
    examNo: 'EX20260512002',
    patientId: 'P001',
    patientName: '张三',
    createdAt: now.toISOString(),
    expiresAt: tomorrow.toISOString(),
    status: 'active'
  }
];

export const mockPrintRecords: PrintRecord[] = [
  {
    id: 'PR001',
    examNo: 'EX20260509001',
    pickupCode: '20260509-9876',
    patientId: 'P003',
    patientName: '王五',
    printType: 'original',
    printedAt: oneDayAgo.toISOString(),
    filmCount: 2,
    operatorId: 'OP001',
    operatorName: '自助终端',
    status: 'success',
    printerId: 'PRT001',
    printerName: '一楼取片台打印机1号'
  }
];

export const mockReprintRequests: ReprintRequest[] = [
  {
    id: 'RR001',
    examNo: 'EX20260510001',
    patientId: 'P001',
    patientName: '张三',
    pickupCode: '20260510-8876',
    reason: '胶片损坏',
    applicantName: '张三',
    applicantId: 'P001',
    appliedAt: oneDayAgo.toISOString(),
    status: 'pending'
  }
];

export const mockAbnormalRecords: AbnormalRecord[] = [
  {
    id: 'AB001',
    examNo: 'EX20260510001',
    pickupCode: '20260510-8876-INVALID',
    patientId: 'P001',
    patientName: '张三',
    type: 'code_invalid',
    description: '取片码格式错误，应为8位数字+短横线格式',
    occurredAt: twoDaysAgo.toISOString(),
    status: 'resolved',
    resolvedBy: '系统自动处理',
    resolvedAt: twoDaysAgo.toISOString(),
    resolution: '已提示用户重新输入正确格式的取片码'
  },
  {
    id: 'AB002',
    examNo: 'EX20260511001',
    pickupCode: '20260511-6543',
    patientId: 'P002',
    patientName: '李四',
    type: 'mismatch',
    description: '患者信息与取片码不匹配，检查号不一致',
    occurredAt: oneDayAgo.toISOString(),
    status: 'pending'
  }
];

export const mockHistory: HistoryEntry[] = [
  {
    id: 'H001',
    type: 'pickup',
    targetId: 'FP001',
    action: '生成取片码',
    timestamp: twoDaysAgo.toISOString(),
    details: { examNo: 'EX20260510001', patientName: '张三', pickupCode: '20260510-8876' }
  },
  {
    id: 'H002',
    type: 'print',
    targetId: 'PR001',
    action: '胶片打印成功',
    timestamp: oneDayAgo.toISOString(),
    details: { examNo: 'EX20260509001', patientName: '王五', filmCount: 2, printer: '一楼取片台打印机1号' }
  },
  {
    id: 'H003',
    type: 'reprint_request',
    targetId: 'RR001',
    action: '提交补打申请',
    timestamp: oneDayAgo.toISOString(),
    details: { examNo: 'EX20260510001', patientName: '张三', reason: '胶片损坏' }
  },
  {
    id: 'H004',
    type: 'abnormal',
    targetId: 'AB001',
    action: '异常记录已处理',
    timestamp: twoDaysAgo.toISOString(),
    details: { type: '取片码无效', description: '取片码格式错误' }
  }
];

export const mockPrinters = [
  { id: 'PRT001', name: '一楼取片台打印机1号', status: 'ready', location: '门诊大厅一楼' },
  { id: 'PRT002', name: '一楼取片台打印机2号', status: 'ready', location: '门诊大厅一楼' },
  { id: 'PRT003', name: '二楼取片台打印机1号', status: 'offline', location: '门诊大厅二楼' }
];
