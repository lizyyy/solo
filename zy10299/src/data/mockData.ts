import { Competition, Student, Award, Certificate, ReissueRequest, CorrectionRecord } from '../types';

export const competitions: Competition[] = [
  {
    id: 'comp-001',
    name: '全国大学生数学建模竞赛',
    organizer: '教育部高等教育司',
    date: '2024-09-15',
    level: 'national'
  },
  {
    id: 'comp-002',
    name: '省级大学生程序设计大赛',
    organizer: '省教育厅',
    date: '2024-10-20',
    level: 'provincial'
  },
  {
    id: 'comp-003',
    name: '校级英语演讲比赛',
    organizer: '校团委',
    date: '2024-11-05',
    level: 'school'
  }
];

export const students: Student[] = [
  {
    id: 'stu-001',
    name: '张三',
    studentId: '20220101',
    className: '计算机2201班',
    grade: '2022级',
    college: '计算机学院'
  },
  {
    id: 'stu-002',
    name: '李四',
    studentId: '20220102',
    className: '计算机2201班',
    grade: '2022级',
    college: '计算机学院'
  },
  {
    id: 'stu-003',
    name: '王五',
    studentId: '20220201',
    className: '数学2201班',
    grade: '2022级',
    college: '数学与统计学院'
  },
  {
    id: 'stu-004',
    name: '赵六',
    studentId: '20220301',
    className: '英语2201班',
    grade: '2022级',
    college: '外国语学院'
  }
];

export const awards: Award[] = [
  {
    id: 'award-001',
    competitionId: 'comp-001',
    studentId: 'stu-001',
    awardLevel: 'first',
    verified: true,
    verifiedBy: 'admin',
    verifiedAt: '2024-10-01'
  },
  {
    id: 'award-002',
    competitionId: 'comp-001',
    studentId: 'stu-003',
    awardLevel: 'second',
    verified: true,
    verifiedBy: 'admin',
    verifiedAt: '2024-10-01'
  },
  {
    id: 'award-003',
    competitionId: 'comp-002',
    studentId: 'stu-002',
    awardLevel: 'third',
    verified: false
  },
  {
    id: 'award-004',
    competitionId: 'comp-003',
    studentId: 'stu-004',
    awardLevel: 'excellence',
    verified: true,
    verifiedBy: 'admin',
    verifiedAt: '2024-11-10'
  }
];

export const certificates: Certificate[] = [
  {
    id: 'cert-001',
    certificateNo: 'CERT-2024-NAT-001',
    awardId: 'award-001',
    studentId: 'stu-001',
    studentName: '张三',
    issueDate: '2024-10-15',
    status: 'valid',
    isOriginal: true,
    printed: true,
    printedAt: '2024-10-15'
  },
  {
    id: 'cert-002',
    certificateNo: 'CERT-2024-NAT-002',
    awardId: 'award-002',
    studentId: 'stu-003',
    studentName: '王五',
    issueDate: '2024-10-15',
    status: 'invalid',
    isOriginal: true,
    printed: true,
    printedAt: '2024-10-15'
  },
  {
    id: 'cert-003',
    certificateNo: 'CERT-2024-NAT-002-R001',
    awardId: 'award-002',
    studentId: 'stu-003',
    studentName: '王伍',
    issueDate: '2024-11-01',
    status: 'valid',
    isOriginal: false,
    reissueFrom: 'cert-002',
    printed: true,
    printedAt: '2024-11-01'
  },
  {
    id: 'cert-004',
    certificateNo: 'CERT-2024-PRO-001',
    awardId: 'award-003',
    studentId: 'stu-002',
    studentName: '李四',
    issueDate: '2024-11-10',
    status: 'valid',
    isOriginal: true,
    printed: true,
    printedAt: '2024-11-10'
  },
  {
    id: 'cert-005',
    certificateNo: 'CERT-2024-SCH-001',
    awardId: 'award-004',
    studentId: 'stu-004',
    studentName: '赵六',
    issueDate: '2024-11-15',
    status: 'valid',
    isOriginal: true,
    printed: false
  }
];

export const reissueRequests: ReissueRequest[] = [
  {
    id: 'req-001',
    certificateId: 'cert-002',
    awardId: 'award-002',
    studentId: 'stu-003',
    originalName: '王五',
    correctedName: '王伍',
    reason: '证书姓名打印错误，应为"王伍"',
    reasonCategory: 'name_error',
    receiver: '王伍',
    receiverType: 'student',
    receiverPhone: '13800138000',
    status: 'completed',
    createdAt: '2024-10-25',
    approvedAt: '2024-10-26',
    completedAt: '2024-11-01',
    operatorId: 'admin',
    newCertificateId: 'cert-003'
  },
  {
    id: 'req-002',
    certificateId: 'cert-001',
    awardId: 'award-001',
    studentId: 'stu-001',
    originalName: '张三',
    reason: '证书遗失',
    reasonCategory: 'lost',
    receiver: '张老师',
    receiverType: 'class_teacher',
    receiverPhone: '13900139000',
    classTeacherVerification: true,
    status: 'pending',
    createdAt: '2024-12-01'
  },
  {
    id: 'req-003',
    certificateId: 'cert-004',
    awardId: 'award-003',
    studentId: 'stu-002',
    originalName: '李四',
    reason: '证书损坏',
    reasonCategory: 'damaged',
    receiver: '李老师',
    receiverType: 'class_teacher',
    classTeacherVerification: false,
    status: 'blocked',
    blockerReason: '班主任代领缺少验证未登记',
    createdAt: '2024-12-05'
  },
  {
    id: 'req-004',
    certificateId: 'cert-005',
    awardId: 'award-004',
    studentId: 'stu-004',
    originalName: '赵六',
    correctedName: '赵柳',
    reason: '姓名更正',
    reasonCategory: 'name_error',
    receiver: '赵柳',
    receiverType: 'student',
    status: 'pending',
    createdAt: '2024-12-10'
  }
];

export const correctionRecords: CorrectionRecord[] = [
  {
    id: 'corr-001',
    reissueRequestId: 'req-001',
    certificateId: 'cert-002',
    oldCertificateNo: 'CERT-2024-NAT-002',
    newCertificateNo: 'CERT-2024-NAT-002-R001',
    oldName: '王五',
    newName: '王伍',
    reason: '证书姓名打印错误',
    createdAt: '2024-11-01',
    operatorId: 'admin'
  }
];
