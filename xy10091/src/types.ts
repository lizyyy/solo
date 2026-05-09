export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'abnormal';
export type PaymentStatus = 'unpaid' | 'paid';
export type CompletionStatus = 'incomplete' | 'completed';

export interface Student {
  id: string;
  name: string;
  phone: string;
  idCard: string;
  email: string;
}

export interface CourseRecord {
  id: string;
  studentId: string;
  courseName: string;
  courseCode: string;
  enrollmentDate: string;
  completionDate: string | null;
  completionStatus: CompletionStatus;
  score: number | null;
  certificateIssued: boolean;
}

export interface PaymentRecord {
  id: string;
  studentId: string;
  courseCode: string;
  amount: number;
  paymentDate: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  transactionId: string | null;
  reissueFee: number;
  reissueFeePaid: boolean;
}

export interface MailingAddress {
  id: string;
  studentId: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  postalCode: string;
  isDefault: boolean;
}

export interface ReissueRequest {
  id: string;
  requestNo: string;
  studentId: string;
  student: Student;
  courseCode: string;
  courseName: string;
  reason: string;
  reviewStatus: ReviewStatus;
  reviewComment: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  courseRecord: CourseRecord | null;
  paymentRecord: PaymentRecord | null;
  mailingAddress: MailingAddress | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  abnormalType: string | null;
  abnormalReason: string | null;
}

export interface ReviewHistory {
  id: string;
  requestId: string;
  action: 'created' | 'submitted' | 'approved' | 'rejected' | 'abnormal' | 'shipped' | 'delivered';
  operatorId: string | null;
  operatorName: string | null;
  comment: string | null;
  createdAt: string;
  oldStatus: ReviewStatus | null;
  newStatus: ReviewStatus | null;
}

export interface ReviewFilters {
  keyword?: string;
  status?: ReviewStatus;
  courseCode?: string;
  startDate?: string;
  endDate?: string;
  hasAbnormal?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportData {
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  abnormalCount: number;
  averageReviewTime: number;
  courseStats: {
    courseCode: string;
    courseName: string;
    count: number;
  }[];
  monthlyStats: {
    month: string;
    count: number;
  }[];
  abnormalReasons: {
    reason: string;
    count: number;
  }[];
}

export const statusMap: Record<ReviewStatus, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  abnormal: { label: '异常', color: 'bg-orange-100 text-orange-800' },
};

export const actionMap: Record<string, string> = {
  created: '创建申请',
  submitted: '提交审核',
  approved: '审核通过',
  rejected: '审核拒绝',
  abnormal: '标记异常',
  shipped: '已发货',
  delivered: '已签收',
};
