import { Router, Request, Response } from 'express';
import { loadData, saveData, generateRequestNo, now, uuidv4 } from './database';
import type { ReviewStatus, ReviewFilters, ReviewHistory } from './types';
import { Parser } from 'json2csv';
import dayjs from 'dayjs';

const router = Router();

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

export default router;
