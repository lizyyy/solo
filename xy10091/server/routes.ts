import { Router, Request, Response } from 'express';
import multer from 'multer';
import { loadData, saveData, generateRequestNo, now, uuidv4 } from './database';
import type { ReviewStatus, ReviewFilters, ReviewHistory } from './types';
import { Parser } from 'json2csv';
import dayjs from 'dayjs';

const router = Router();

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || 
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只支持 CSV 文件'));
    }
  },
});

function rowToStudent(row: any): any {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    idCard: row.id_card,
    email: row.email,
  };
}

function buildRequestQuery(filters: ReviewFilters, requests: any[], students: any[]) {
  return requests.filter((r) => {
    const student = students.find((s) => s.id === r.student_id);
    if (!student) return false;

    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      const matchNo = r.request_no.toLowerCase().includes(kw);
      const matchName = student.name.toLowerCase().includes(kw);
      const matchPhone = student.phone.includes(kw);
      if (!matchNo && !matchName && !matchPhone) return false;
    }

    if (filters.status && r.review_status !== filters.status) return false;

    if (filters.courseCode && r.course_code !== filters.courseCode) return false;

    if (filters.startDate && r.created_at < filters.startDate) return false;
    if (filters.endDate && r.created_at > filters.endDate) return false;

    if (filters.hasAbnormal && !r.abnormal_reason) return false;

    return true;
  });
}

function buildResponse(request: any, student: any, courseRecord: any | null, paymentRecord: any | null, mailingAddress: any | null) {
  return {
    id: request.id,
    requestNo: request.request_no,
    studentId: request.student_id,
    student: rowToStudent(student),
    courseCode: request.course_code,
    courseName: request.course_name,
    reason: request.reason,
    reviewStatus: request.review_status,
    reviewComment: request.review_comment,
    reviewerId: request.reviewer_id,
    reviewerName: request.reviewer_name,
    reviewedAt: request.reviewed_at,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    courseRecord: courseRecord ? {
      id: courseRecord.id,
      studentId: courseRecord.student_id,
      courseName: courseRecord.course_name,
      courseCode: courseRecord.course_code,
      enrollmentDate: courseRecord.enrollment_date,
      completionDate: courseRecord.completion_date,
      completionStatus: courseRecord.completion_status,
      score: courseRecord.score,
      certificateIssued: !!courseRecord.certificate_issued,
    } : null,
    paymentRecord: paymentRecord ? {
      id: paymentRecord.id,
      studentId: paymentRecord.student_id,
      courseCode: paymentRecord.course_code,
      amount: paymentRecord.amount,
      paymentDate: paymentRecord.payment_date,
      paymentStatus: paymentRecord.payment_status,
      paymentMethod: paymentRecord.payment_method,
      transactionId: paymentRecord.transaction_id,
      reissueFee: paymentRecord.reissue_fee,
      reissueFeePaid: !!paymentRecord.reissue_fee_paid,
    } : null,
    mailingAddress: mailingAddress ? {
      id: mailingAddress.id,
      studentId: mailingAddress.student_id,
      name: mailingAddress.name,
      phone: mailingAddress.phone,
      province: mailingAddress.province,
      city: mailingAddress.city,
      district: mailingAddress.district,
      address: mailingAddress.address,
      postalCode: mailingAddress.postal_code,
      isDefault: !!mailingAddress.is_default,
    } : null,
    trackingNumber: request.tracking_number,
    shippedAt: request.shipped_at,
    deliveredAt: request.delivered_at,
    abnormalType: request.abnormal_type,
    abnormalReason: request.abnormal_reason,
  };
}

function enrichRequests(requests: any[], students: any[], courseRecords: any[], paymentRecords: any[], mailingAddresses: any[]) {
  return requests.map((r) => {
    const student = students.find((s) => s.id === r.student_id)!;
    const courseRecord = courseRecords.find((c) => c.student_id === r.student_id && c.course_code === r.course_code) || null;
    const paymentRecord = paymentRecords.find((p) => p.student_id === r.student_id && p.course_code === r.course_code) || null;
    const mailingAddress = mailingAddresses.find((a) => a.student_id === r.student_id && a.is_default) || mailingAddresses.find((a) => a.student_id === r.student_id) || null;
    return buildResponse(r, student, courseRecord, paymentRecord, mailingAddress);
  });
}

router.get('/requests', (req: Request, res: Response) => {
  try {
    const db = loadData();
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const offset = (page - 1) * pageSize;

    const filters: ReviewFilters = {
      keyword: req.query.keyword as string | undefined,
      status: req.query.status as ReviewStatus | undefined,
      courseCode: req.query.courseCode as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      hasAbnormal: req.query.hasAbnormal === 'true',
    };

    const filtered = buildRequestQuery(filters, db.reissueRequests, db.students);
    const sorted = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const paged = sorted.slice(offset, offset + pageSize);
    const enriched = enrichRequests(paged, db.students, db.courseRecords, db.paymentRecords, db.mailingAddresses);

    res.json({
      data: enriched,
      total: filtered.length,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: '获取申请列表失败' });
  }
});

router.get('/requests/:id', (req: Request, res: Response) => {
  try {
    const db = loadData();
    const request = db.reissueRequests.find((r) => r.id === req.params.id);
    if (!request) {
      return res.status(404).json({ error: '申请不存在' });
    }

    const student = db.students.find((s) => s.id === request.student_id)!;
    const courseRecord = db.courseRecords.find((c) => c.student_id === request.student_id && c.course_code === request.course_code) || null;
    const paymentRecord = db.paymentRecords.find((p) => p.student_id === request.student_id && p.course_code === request.course_code) || null;
    const mailingAddress = db.mailingAddresses.find((a) => a.student_id === request.student_id && a.is_default) || db.mailingAddresses.find((a) => a.student_id === request.student_id) || null;

    res.json(buildResponse(request, student, courseRecord, paymentRecord, mailingAddress));
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: '获取申请详情失败' });
  }
});

router.get('/requests/:id/history', (req: Request, res: Response) => {
  try {
    const db = loadData();
    const history = db.reviewHistory
      .filter((h) => h.request_id === req.params.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((row: any): ReviewHistory => ({
        id: row.id,
        requestId: row.request_id,
        action: row.action,
        operatorId: row.operator_id,
        operatorName: row.operator_name,
        comment: row.comment,
        createdAt: row.created_at,
        oldStatus: row.old_status,
        newStatus: row.new_status,
      }));

    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

router.post('/requests/:id/approve', (req: Request, res: Response) => {
  try {
    const { comment, reviewerName } = req.body;
    const requestId = req.params.id;
    const currentTime = now();

    const db = loadData();
    const request = db.reissueRequests.find((r) => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: '申请不存在' });
    }

    const oldStatus = request.review_status;
    request.review_status = 'approved';
    request.review_comment = comment || null;
    request.reviewer_name = reviewerName || '系统审核';
    request.reviewed_at = currentTime;
    request.updated_at = currentTime;

    db.reviewHistory.push({
      id: uuidv4(),
      request_id: requestId,
      action: 'approved',
      operator_id: null,
      operator_name: reviewerName || '系统审核',
      comment: comment || '审核通过',
      old_status: oldStatus,
      new_status: 'approved',
      created_at: currentTime,
    });

    saveData(db);
    res.json({ success: true });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: '审核操作失败' });
  }
});

router.post('/requests/:id/reject', (req: Request, res: Response) => {
  try {
    const { comment, reviewerName } = req.body;
    const requestId = req.params.id;
    const currentTime = now();

    if (!comment) {
      return res.status(400).json({ error: '拒绝原因不能为空' });
    }

    const db = loadData();
    const request = db.reissueRequests.find((r) => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: '申请不存在' });
    }

    const oldStatus = request.review_status;
    request.review_status = 'rejected';
    request.review_comment = comment;
    request.reviewer_name = reviewerName || '系统审核';
    request.reviewed_at = currentTime;
    request.updated_at = currentTime;

    db.reviewHistory.push({
      id: uuidv4(),
      request_id: requestId,
      action: 'rejected',
      operator_id: null,
      operator_name: reviewerName || '系统审核',
      comment,
      old_status: oldStatus,
      new_status: 'rejected',
      created_at: currentTime,
    });

    saveData(db);
    res.json({ success: true });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: '审核操作失败' });
  }
});

router.post('/requests/:id/abnormal', (req: Request, res: Response) => {
  try {
    const { abnormalType, abnormalReason, reviewerName } = req.body;
    const requestId = req.params.id;
    const currentTime = now();

    if (!abnormalType || !abnormalReason) {
      return res.status(400).json({ error: '异常类型和原因不能为空' });
    }

    const db = loadData();
    const request = db.reissueRequests.find((r) => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: '申请不存在' });
    }

    const oldStatus = request.review_status;
    request.review_status = 'abnormal';
    request.abnormal_type = abnormalType;
    request.abnormal_reason = abnormalReason;
    request.reviewer_name = reviewerName || '系统审核';
    request.reviewed_at = currentTime;
    request.updated_at = currentTime;

    db.reviewHistory.push({
      id: uuidv4(),
      request_id: requestId,
      action: 'abnormal',
      operator_id: null,
      operator_name: reviewerName || '系统审核',
      comment: abnormalReason,
      old_status: oldStatus,
      new_status: 'abnormal',
      created_at: currentTime,
    });

    saveData(db);
    res.json({ success: true });
  } catch (error) {
    console.error('Abnormal error:', error);
    res.status(500).json({ error: '标记异常失败' });
  }
});

router.post('/requests/:id/ship', (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.body;
    const requestId = req.params.id;
    const currentTime = now();

    if (!trackingNumber) {
      return res.status(400).json({ error: '快递单号不能为空' });
    }

    const db = loadData();
    const request = db.reissueRequests.find((r) => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: '申请不存在' });
    }

    request.tracking_number = trackingNumber;
    request.shipped_at = currentTime;
    request.updated_at = currentTime;

    db.reviewHistory.push({
      id: uuidv4(),
      request_id: requestId,
      action: 'shipped',
      operator_id: null,
      operator_name: null,
      comment: `已发货，快递单号：${trackingNumber}`,
      old_status: null,
      new_status: null,
      created_at: currentTime,
    });

    saveData(db);
    res.json({ success: true });
  } catch (error) {
    console.error('Ship error:', error);
    res.status(500).json({ error: '发货操作失败' });
  }
});

router.post('/requests', (req: Request, res: Response) => {
  try {
    const { studentId, courseCode, courseName, reason } = req.body;
    const currentTime = now();

    if (!studentId || !courseCode || !reason) {
      return res.status(400).json({ error: '必填字段缺失' });
    }

    const db = loadData();
    const id = uuidv4();

    db.reissueRequests.push({
      id,
      request_no: generateRequestNo(),
      student_id: studentId,
      course_code: courseCode,
      course_name: courseName || '',
      reason,
      review_status: 'pending',
      review_comment: null,
      reviewer_id: null,
      reviewer_name: null,
      reviewed_at: null,
      tracking_number: null,
      shipped_at: null,
      delivered_at: null,
      abnormal_type: null,
      abnormal_reason: null,
      created_at: currentTime,
      updated_at: currentTime,
    });

    db.reviewHistory.push({
      id: uuidv4(),
      request_id: id,
      action: 'created',
      operator_id: null,
      operator_name: null,
      comment: reason,
      old_status: null,
      new_status: 'pending',
      created_at: currentTime,
    });

    saveData(db);
    res.json({ id, success: true });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: '创建申请失败' });
  }
});

router.get('/export', (req: Request, res: Response) => {
  try {
    const db = loadData();
    const filters: ReviewFilters = {
      keyword: req.query.keyword as string | undefined,
      status: req.query.status as ReviewStatus | undefined,
      courseCode: req.query.courseCode as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const filtered = buildRequestQuery(filters, db.reissueRequests, db.students);
    const sorted = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const statusMap: Record<string, string> = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
      abnormal: '异常',
    };

    const data = sorted.map((row) => {
      const student = db.students.find((s) => s.id === row.student_id);
      const cr = db.courseRecords.find((c) => c.student_id === row.student_id && c.course_code === row.course_code);
      const pr = db.paymentRecords.find((p) => p.student_id === row.student_id && p.course_code === row.course_code);

      return {
        '申请编号': row.request_no,
        '学员姓名': student?.name || '-',
        '联系电话': student?.phone || '-',
        '身份证号': student?.id_card || '-',
        '课程代码': row.course_code,
        '课程名称': row.course_name,
        '补发原因': row.reason,
        '完课状态': cr?.completion_status === 'completed' ? '已完成' : '未完成',
        '成绩': cr?.score ?? '-',
        '缴费状态': pr?.payment_status === 'paid' ? '已缴费' : '未缴费',
        '补发费用': pr?.reissue_fee_paid ? '已支付' : '未支付',
        '审核状态': statusMap[row.review_status] || row.review_status,
        '审核意见': row.review_comment || '-',
        '审核人': row.reviewer_name || '-',
        '审核时间': row.reviewed_at ? dayjs(row.reviewed_at).format('YYYY-MM-DD HH:mm:ss') : '-',
        '申请时间': dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss'),
      };
    });

    const parser = new Parser();
    const csv = parser.parse(data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-reissues-${dayjs().format('YYYYMMDDHHmmss')}.csv"`);
    res.send('\ufeff' + csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

router.get('/report', (_req: Request, res: Response) => {
  try {
    const db = loadData();

    const total = db.reissueRequests.length;
    const pending = db.reissueRequests.filter((r) => r.review_status === 'pending').length;
    const approved = db.reissueRequests.filter((r) => r.review_status === 'approved').length;
    const rejected = db.reissueRequests.filter((r) => r.review_status === 'rejected').length;
    const abnormal = db.reissueRequests.filter((r) => r.review_status === 'abnormal').length;

    const courseMap = new Map<string, { courseCode: string; courseName: string; count: number }>();
    db.reissueRequests.forEach((r) => {
      const key = r.course_code;
      const existing = courseMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        courseMap.set(key, { courseCode: r.course_code, courseName: r.course_name, count: 1 });
      }
    });
    const courseStats = Array.from(courseMap.values()).sort((a, b) => b.count - a.count);

    const monthMap = new Map<string, number>();
    db.reissueRequests.forEach((r) => {
      const month = dayjs(r.created_at).format('YYYY-MM');
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    });
    const monthlyStats = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    const abnormalMap = new Map<string, number>();
    db.reissueRequests.forEach((r) => {
      if (r.abnormal_reason) {
        abnormalMap.set(r.abnormal_reason, (abnormalMap.get(r.abnormal_reason) || 0) + 1);
      }
    });
    const abnormalReasons = Array.from(abnormalMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count }));

    const reviewedRequests = db.reissueRequests.filter((r) => r.reviewed_at);
    let avgDays = 0;
    if (reviewedRequests.length > 0) {
      const totalDays = reviewedRequests.reduce((sum, r) => {
        const diff = dayjs(r.reviewed_at).diff(dayjs(r.created_at), 'day', true);
        return sum + diff;
      }, 0);
      avgDays = totalDays / reviewedRequests.length;
    }

    res.json({
      totalRequests: total,
      pendingCount: pending,
      approvedCount: approved,
      rejectedCount: rejected,
      abnormalCount: abnormal,
      averageReviewTime: avgDays,
      courseStats,
      monthlyStats,
      abnormalReasons,
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: '获取报告失败' });
  }
});

router.get('/students/search', (req: Request, res: Response) => {
  try {
    const keyword = (req.query.keyword as string)?.toLowerCase() || '';
    if (keyword.length < 1) {
      return res.json([]);
    }

    const db = loadData();
    const matchedStudents = db.students.filter((s) =>
      s.name.toLowerCase().includes(keyword) ||
      s.phone.includes(keyword) ||
      s.id_card.includes(keyword)
    );

    const results: any[] = [];
    matchedStudents.forEach((s) => {
      const courses = db.courseRecords.filter((c) => c.student_id === s.id);
      if (courses.length === 0) {
        results.push({
          ...s,
          id_card: s.id_card,
          course_code: null,
          course_name: null,
          completion_status: null,
          payment_status: null,
          reissue_fee_paid: null,
        });
      } else {
        courses.forEach((c) => {
          const payment = db.paymentRecords.find((p) => p.student_id === s.id && p.course_code === c.course_code);
          results.push({
            ...s,
            id_card: s.id_card,
            course_code: c.course_code,
            course_name: c.course_name,
            completion_status: c.completion_status,
            payment_status: payment?.payment_status || 'unpaid',
            reissue_fee_paid: payment?.reissue_fee_paid || 0,
          });
        });
      }
    });

    res.json(results.slice(0, 10));
  } catch (error) {
    console.error('Student search error:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

router.get('/courses', (_req: Request, res: Response) => {
  try {
    const db = loadData();
    const seen = new Set<string>();
    const courses: any[] = [];

    db.courseRecords.forEach((c) => {
      if (!seen.has(c.course_code)) {
        seen.add(c.course_code);
        courses.push({ courseCode: c.course_code, courseName: c.course_name });
      }
    });

    courses.sort((a, b) => a.courseCode.localeCompare(b.courseCode));
    res.json(courses);
  } catch (error) {
    console.error('Courses error:', error);
    res.status(500).json({ error: '获取课程列表失败' });
  }
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function mapCsvRowToData(row: string[], headers: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    obj[header.trim()] = row[index] || '';
  });
  return obj;
}

function parseDate(value: string): string {
  if (!value) return now();
  const d = dayjs(value);
  if (d.isValid()) return d.toISOString();
  return now();
}

router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV 文件格式错误：至少需要表头和一行数据' });
    }

    const headers = parseCSVLine(lines[0]);
    const requiredHeaders = [
      '申请编号', '学员姓名', '手机号', '身份证号', '课程代码', '课程名称', 
      '申请原因', '审核状态', '创建时间'
    ];

    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({ 
        error: `CSV 文件缺少必需列：${missingHeaders.join('、')}`,
        requiredHeaders
      });
    }

    const db = loadData();
    const results: {
      success: number;
      skipped: number;
      failed: number;
      messages: string[];
    } = {
      success: 0,
      skipped: 0,
      failed: 0,
      messages: []
    };

    const existingRequestNos = new Set(db.reissueRequests.map((r: any) => r.request_no));
    const existingPhones = new Map(db.students.map((s: any) => [s.phone, s]));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const row = mapCsvRowToData(parseCSVLine(line), headers);
        const requestNo = row['申请编号'];

        if (!requestNo || existingRequestNos.has(requestNo)) {
          results.skipped++;
          results.messages.push(`第 ${i} 行跳过：申请编号 "${requestNo}" 已存在或为空`);
          continue;
        }

        let studentId = '';
        const phone = row['手机号'];
        
        if (phone && existingPhones.has(phone)) {
          studentId = (existingPhones.get(phone) as any).id;
        } else {
          studentId = uuidv4();
          const newStudent = {
            id: studentId,
            name: row['学员姓名'],
            phone: phone,
            id_card: row['身份证号'] || '',
            email: row['邮箱'] || '',
            created_at: now(),
            updated_at: now(),
          };
          db.students.push(newStudent);
          existingPhones.set(phone, newStudent);
        }

        const courseCode = row['课程代码'];
        const courseName = row['课程名称'];

        let courseRecordId = '';
        let courseRecord = db.courseRecords.find(
          (c: any) => c.student_id === studentId && c.course_code === courseCode
        );
        
        if (!courseRecord) {
          courseRecordId = uuidv4();
          db.courseRecords.push({
            id: courseRecordId,
            student_id: studentId,
            course_name: courseName,
            course_code: courseCode,
            enrollment_date: parseDate(row['入学时间'] || now()),
            completion_date: parseDate(row['完课时间'] || now()),
            completion_status: row['完课状态'] || 'completed',
            score: parseInt(row['成绩']) || 0,
            certificate_issued: (row['证书已发放']?.toLowerCase() === 'true' || row['证书已发放'] === '1'),
            created_at: now(),
            updated_at: now(),
          });
        } else {
          courseRecordId = courseRecord.id;
        }

        let paymentRecordId = '';
        let paymentRecord = db.paymentRecords.find(
          (p: any) => p.student_id === studentId && p.course_code === courseCode
        );
        
        if (!paymentRecord) {
          paymentRecordId = uuidv4();
          db.paymentRecords.push({
            id: paymentRecordId,
            student_id: studentId,
            course_code: courseCode,
            amount: parseFloat(row['课程费用']) || 0,
            payment_date: parseDate(row['缴费时间'] || now()),
            payment_status: row['缴费状态'] || 'paid',
            payment_method: row['支付方式'] || '在线支付',
            transaction_id: row['交易流水号'] || '',
            reissue_fee: parseFloat(row['补发费用']) || 20,
            reissue_fee_paid: (row['补发费用已缴']?.toLowerCase() === 'true' || row['补发费用已缴'] === '1'),
            created_at: now(),
            updated_at: now(),
          });
        } else {
          paymentRecordId = paymentRecord.id;
        }

        let addressId = '';
        let address = db.mailingAddresses.find((a: any) => a.student_id === studentId);
        
        if (!address && row['邮寄地址']) {
          addressId = uuidv4();
          db.mailingAddresses.push({
            id: addressId,
            student_id: studentId,
            name: row['收件人姓名'] || row['学员姓名'],
            phone: row['收件人手机号'] || phone,
            province: row['省份'] || '',
            city: row['城市'] || '',
            district: row['区县'] || '',
            address: row['邮寄地址'] || '',
            postal_code: row['邮编'] || '',
            is_default: true,
            created_at: now(),
            updated_at: now(),
          });
        } else if (address) {
          addressId = address.id;
        }

        const statusMap: Record<string, string> = {
          '待审核': 'pending',
          '已通过': 'approved',
          '已拒绝': 'rejected',
          '异常': 'abnormal',
          '已发货': 'shipped',
          '已完成': 'completed',
        };

        const reviewStatus = statusMap[row['审核状态']] || 'pending';

        const request = {
          id: uuidv4(),
          request_no: requestNo,
          student_id: studentId,
          course_code: courseCode,
          course_name: courseName,
          reason: row['申请原因'],
          review_status: reviewStatus as ReviewStatus,
          review_comment: row['审核意见'] || null,
          reviewer_id: null,
          reviewer_name: row['审核人'] || null,
          reviewed_at: row['审核时间'] ? parseDate(row['审核时间']) : null,
          created_at: parseDate(row['创建时间'] || now()),
          updated_at: now(),
          course_record_id: courseRecordId,
          payment_record_id: paymentRecordId,
          mailing_address_id: addressId || null,
          tracking_number: row['快递单号'] || null,
          shipped_at: row['发货时间'] ? parseDate(row['发货时间']) : null,
          delivered_at: row['签收时间'] ? parseDate(row['签收时间']) : null,
          abnormal_type: row['异常类型'] || null,
          abnormal_reason: row['异常原因'] || null,
        };

        db.reissueRequests.push(request);
        existingRequestNos.add(requestNo);
        results.success++;

        if (row['操作历史']) {
          db.reviewHistory.push({
            id: uuidv4(),
            request_id: request.id,
            action: 'import',
            comment: '批量导入',
            operator: '系统',
            created_at: now(),
          });
        }

      } catch (rowError: any) {
        results.failed++;
        results.messages.push(`第 ${i} 行错误：${rowError.message || '未知错误'}`);
      }
    }

    saveData(db);

    res.json({
      success: true,
      ...results,
      total: results.success + results.skipped + results.failed,
    });

  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message || '导入失败' });
  }
});

router.get('/import/template', (_req: Request, res: Response) => {
  const headers = [
    '申请编号', '学员姓名', '手机号', '身份证号', '邮箱', '课程代码', '课程名称',
    '申请原因', '审核状态', '审核意见', '审核人', '审核时间',
    '入学时间', '完课时间', '完课状态', '成绩', '证书已发放',
    '课程费用', '缴费时间', '缴费状态', '支付方式', '交易流水号',
    '补发费用', '补发费用已缴',
    '收件人姓名', '收件人手机号', '省份', '城市', '区县', '邮寄地址', '邮编',
    '快递单号', '发货时间', '签收时间',
    '异常类型', '异常原因', '创建时间'
  ];

  const sampleRow = [
    'CR202601010001', '示例学员', '13800000001', '110101199001011234', 'student@example.com',
    'PY001', 'Python基础编程', '证书损坏需要重新打印', '待审核', '', '', '',
    '2025-09-01', '2025-12-15', 'completed', '85', 'true',
    '2999', '2025-09-01', 'paid', '支付宝', 'ALI123456789',
    '20', 'true',
    '示例学员', '13800000001', '北京市', '北京市', '朝阳区',
    '建国路88号SOHO现代城A座1508室', '100022',
    '', '', '',
    '', '', '2026-01-01 10:00:00'
  ];

  const sampleRow2 = [
    'CR202601010002', '测试学员', '13800000002', '110101199001012345', 'test@example.com',
    'WEB001', 'Web前端开发', '证书丢失', '已通过', '审核通过，请尽快补发',
    '张审核', '2026-01-02 14:30:00',
    '2025-10-01', '2026-01-10', 'completed', '92', 'true',
    '3999', '2025-10-01', 'paid', '微信支付', 'WX123456789',
    '20', 'true',
    '测试学员', '13800000002', '上海市', '上海市', '浦东新区',
    '陆家嘴环路1000号恒生银行大厦2202室', '200120',
    'SF1234567890', '2026-01-03', '',
    '', '', '2026-01-01 11:00:00'
  ];

  const csvContent = [
    headers.join(','),
    sampleRow.join(','),
    sampleRow2.join(',')
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="import_template.csv"');
  res.send('\uFEFF' + csvContent);
});

export default router;
