import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const dataDir = path.resolve(__dirname, '../data');
const dataFile = path.join(dataDir, 'data.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

interface DatabaseData {
  students: any[];
  courseRecords: any[];
  paymentRecords: any[];
  mailingAddresses: any[];
  reissueRequests: any[];
  reviewHistory: any[];
}

let dataCache: DatabaseData | null = null;

function defaultData(): DatabaseData {
  return {
    students: [],
    courseRecords: [],
    paymentRecords: [],
    mailingAddresses: [],
    reissueRequests: [],
    reviewHistory: [],
  };
}

function loadData(): DatabaseData {
  if (dataCache) return dataCache;

  if (!fs.existsSync(dataFile)) {
    const initial = createMockData();
    saveData(initial);
    dataCache = initial;
    return initial;
  }

  try {
    const content = fs.readFileSync(dataFile, 'utf-8');
    dataCache = JSON.parse(content);
    return dataCache!;
  } catch {
    const initial = createMockData();
    saveData(initial);
    dataCache = initial;
    return initial;
  }
}

function saveData(d: DatabaseData) {
  dataCache = d;
  fs.writeFileSync(dataFile, JSON.stringify(d, null, 2), 'utf-8');
}

function generateRequestNo(): string {
  const date = dayjs().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CR${date}${random}`;
}

function now(): string {
  return dayjs().toISOString();
}

function createMockData(): DatabaseData {
  const d = defaultData();

  const students = [
    { id: uuidv4(), name: '张三', phone: '13800138001', idCard: '110101199001011234', email: 'zhangsan@example.com' },
    { id: uuidv4(), name: '李四', phone: '13800138002', idCard: '110101199001012345', email: 'lisi@example.com' },
    { id: uuidv4(), name: '王五', phone: '13800138003', idCard: '110101199001013456', email: 'wangwu@example.com' },
    { id: uuidv4(), name: '赵六', phone: '13800138004', idCard: '110101199001014567', email: 'zhaoliu@example.com' },
    { id: uuidv4(), name: '钱七', phone: '13800138005', idCard: '110101199001015678', email: 'qianqi@example.com' },
  ];

  d.students = students.map(s => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    id_card: s.idCard,
    email: s.email,
    created_at: now(),
    updated_at: now(),
  }));

  d.courseRecords = [
    { id: uuidv4(), student_id: students[0].id, course_name: 'Python基础编程', course_code: 'PY001', enrollment_date: dayjs().subtract(6, 'month').toISOString(), completion_date: dayjs().subtract(3, 'month').toISOString(), completion_status: 'completed', score: 85, certificate_issued: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[1].id, course_name: 'Web前端开发', course_code: 'WEB001', enrollment_date: dayjs().subtract(4, 'month').toISOString(), completion_date: dayjs().subtract(1, 'month').toISOString(), completion_status: 'completed', score: 92, certificate_issued: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[2].id, course_name: '数据分析入门', course_code: 'DA001', enrollment_date: dayjs().subtract(8, 'month').toISOString(), completion_date: dayjs().subtract(5, 'month').toISOString(), completion_status: 'completed', score: 78, certificate_issued: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[3].id, course_name: 'Python基础编程', course_code: 'PY001', enrollment_date: dayjs().subtract(2, 'month').toISOString(), completion_date: null, completion_status: 'incomplete', score: null, certificate_issued: 0, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[4].id, course_name: 'Web前端开发', course_code: 'WEB001', enrollment_date: dayjs().subtract(10, 'month').toISOString(), completion_date: dayjs().subtract(7, 'month').toISOString(), completion_status: 'completed', score: 88, certificate_issued: 1, created_at: now(), updated_at: now() },
  ];

  d.paymentRecords = [
    { id: uuidv4(), student_id: students[0].id, course_code: 'PY001', amount: 2999, payment_date: dayjs().subtract(6, 'month').toISOString(), payment_status: 'paid', payment_method: '支付宝', transaction_id: 'ALI12345678901', reissue_fee: 20, reissue_fee_paid: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[1].id, course_code: 'WEB001', amount: 3999, payment_date: dayjs().subtract(4, 'month').toISOString(), payment_status: 'paid', payment_method: '微信支付', transaction_id: 'WX12345678901', reissue_fee: 20, reissue_fee_paid: 0, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[2].id, course_code: 'DA001', amount: 2499, payment_date: dayjs().subtract(8, 'month').toISOString(), payment_status: 'paid', payment_method: '银行卡', transaction_id: 'BANK12345678901', reissue_fee: 20, reissue_fee_paid: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[3].id, course_code: 'PY001', amount: 2999, payment_date: dayjs().subtract(2, 'month').toISOString(), payment_status: 'paid', payment_method: '支付宝', transaction_id: 'ALI12345678902', reissue_fee: 20, reissue_fee_paid: 0, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[4].id, course_code: 'WEB001', amount: 3999, payment_date: dayjs().subtract(10, 'month').toISOString(), payment_status: 'paid', payment_method: '微信支付', transaction_id: 'WX12345678902', reissue_fee: 20, reissue_fee_paid: 1, created_at: now(), updated_at: now() },
  ];

  d.mailingAddresses = [
    { id: uuidv4(), student_id: students[0].id, name: '张三', phone: '13800138001', province: '北京市', city: '北京市', district: '朝阳区', address: '建国路88号SOHO现代城A座1508室', postal_code: '100022', is_default: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[1].id, name: '李四', phone: '13800138002', province: '上海市', city: '上海市', district: '浦东新区', address: '陆家嘴环路1000号恒生银行大厦2202室', postal_code: '200120', is_default: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[2].id, name: '王五', phone: '13800138003', province: '广东省', city: '广州市', district: '天河区', address: '天河北路233号中信广场3206室', postal_code: '510620', is_default: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[3].id, name: '赵六', phone: '13800138004', province: '浙江省', city: '杭州市', district: '西湖区', address: '文三路478号华星科技大厦1805室', postal_code: '310013', is_default: 1, created_at: now(), updated_at: now() },
    { id: uuidv4(), student_id: students[4].id, name: '钱七', phone: '13800138005', province: '江苏省', city: '南京市', district: '鼓楼区', address: '中山北路201号紫峰大厦2808室', postal_code: '210008', is_default: 1, created_at: now(), updated_at: now() },
  ];

  const requests = [
    {
      id: uuidv4(),
      studentId: students[0].id,
      courseCode: 'PY001',
      courseName: 'Python基础编程',
      reason: '证书损坏需要重新打印',
      reviewStatus: 'pending',
      createdAt: dayjs().subtract(2, 'day').toISOString(),
    },
    {
      id: uuidv4(),
      studentId: students[1].id,
      courseCode: 'WEB001',
      courseName: 'Web前端开发',
      reason: '地址变更需要重新邮寄',
      reviewStatus: 'approved',
      reviewComment: '审核通过，请尽快补发',
      reviewerName: '张审核',
      reviewedAt: dayjs().subtract(1, 'day').toISOString(),
      createdAt: dayjs().subtract(3, 'day').toISOString(),
    },
    {
      id: uuidv4(),
      studentId: students[2].id,
      courseCode: 'DA001',
      courseName: '数据分析入门',
      reason: '证书丢失',
      reviewStatus: 'rejected',
      reviewComment: '完课记录不完整，请提供更多证明材料',
      reviewerName: '李审核',
      reviewedAt: dayjs().subtract(1, 'day').toISOString(),
      createdAt: dayjs().subtract(5, 'day').toISOString(),
    },
    {
      id: uuidv4(),
      studentId: students[4].id,
      courseCode: 'WEB001',
      courseName: 'Web前端开发',
      reason: '证书信息有误',
      reviewStatus: 'abnormal',
      abnormalType: 'payment',
      abnormalReason: '补发费用未支付',
      createdAt: dayjs().subtract(4, 'day').toISOString(),
    },
  ];

  d.reissueRequests = requests.map(r => ({
    id: r.id,
    request_no: generateRequestNo(),
    student_id: r.studentId,
    course_code: r.courseCode,
    course_name: r.courseName,
    reason: r.reason,
    review_status: r.reviewStatus,
    review_comment: (r as any).reviewComment || null,
    reviewer_id: null,
    reviewer_name: (r as any).reviewerName || null,
    reviewed_at: (r as any).reviewedAt || null,
    tracking_number: null,
    shipped_at: null,
    delivered_at: null,
    abnormal_type: (r as any).abnormalType || null,
    abnormal_reason: (r as any).abnormalReason || null,
    created_at: r.createdAt,
    updated_at: r.createdAt,
  }));

  d.reissueRequests.forEach((req, idx) => {
    d.reviewHistory.push({
      id: uuidv4(),
      request_id: req.id,
      action: 'created',
      operator_id: null,
      operator_name: null,
      comment: '创建申请',
      old_status: null,
      new_status: 'pending',
      created_at: req.created_at,
    });

    const original = requests[idx];
    const r = original as any;

    if (r.reviewStatus === 'approved') {
      d.reviewHistory.push({
        id: uuidv4(),
        request_id: req.id,
        action: 'approved',
        operator_id: null,
        operator_name: r.reviewerName,
        comment: r.reviewComment,
        old_status: 'pending',
        new_status: 'approved',
        created_at: r.reviewedAt,
      });
    } else if (r.reviewStatus === 'rejected') {
      d.reviewHistory.push({
        id: uuidv4(),
        request_id: req.id,
        action: 'rejected',
        operator_id: null,
        operator_name: r.reviewerName,
        comment: r.reviewComment,
        old_status: 'pending',
        new_status: 'rejected',
        created_at: r.reviewedAt,
      });
    } else if (r.reviewStatus === 'abnormal') {
      d.reviewHistory.push({
        id: uuidv4(),
        request_id: req.id,
        action: 'abnormal',
        operator_id: null,
        operator_name: null,
        comment: r.abnormalReason,
        old_status: 'pending',
        new_status: 'abnormal',
        created_at: req.created_at,
      });
    }
  });

  return d;
}

export {
  loadData,
  saveData,
  generateRequestNo,
  now,
  uuidv4,
};
