import { store } from '../store';
import {
  CertificateStatus,
  RevocationFlow,
  ImportStatus,
  RevocationRecord,
  Certificate,
  PaginationResult,
  PaginationParams
} from '../types';

export interface RevokeRequest {
  certificateNo: string;
  reason: string;
  operatorId: string;
  operatorName: string;
  flow?: RevocationFlow;
}

export interface ReviewRequest {
  revocationId: string;
  approved: boolean;
  reviewComment: string;
  operatorId: string;
  operatorName: string;
}

export interface RejectRequest {
  revocationId: string;
  rejectReason: string;
  operatorId: string;
  operatorName: string;
}

export interface RestoreRequest {
  certificateId: string;
  reason: string;
  operatorId: string;
  operatorName: string;
}

export class RevocationService {
  async revokeCertificate(request: RevokeRequest): Promise<{
    success: boolean;
    message: string;
    data?: RevocationRecord;
  }> {
    const certificate = store.getCertificateByNo(request.certificateNo);

    if (!certificate) {
      return {
        success: false,
        message: `证书 ${request.certificateNo} 不存在`
      };
    }

    if (certificate.status === CertificateStatus.REVOKED) {
      return {
        success: false,
        message: `证书 ${request.certificateNo} 已处于撤销状态`
      };
    }

    if (certificate.status === CertificateStatus.REVOKING) {
      return {
        success: false,
        message: `证书 ${request.certificateNo} 正在撤销中`
      };
    }

    const flow = request.flow || RevocationFlow.NORMAL;
    let newStatus: CertificateStatus;

    switch (flow) {
      case RevocationFlow.MANUAL_REVIEW:
        newStatus = CertificateStatus.REVOKING;
        break;
      case RevocationFlow.REJECT:
        newStatus = CertificateStatus.RESTORE_REQUESTED;
        break;
      case RevocationFlow.NORMAL:
      default:
        newStatus = CertificateStatus.REVOKED;
        break;
    }

    store.updateCertificate(certificate.id, { status: newStatus });

    const revocationRecord = store.createRevocationRecord({
      certificateId: certificate.id,
      certificateNo: certificate.certificateNo,
      courseId: certificate.courseId,
      courseName: certificate.courseName,
      studentId: certificate.studentId,
      studentName: certificate.studentName,
      employeeId: certificate.employeeId,
      reason: request.reason,
      flow,
      status: newStatus,
      operatorId: request.operatorId,
      operatorName: request.operatorName
    });

    return {
      success: true,
      message: flow === RevocationFlow.NORMAL
        ? '证书撤销成功'
        : flow === RevocationFlow.MANUAL_REVIEW
        ? '已提交人工复核'
        : '撤销申请已处理',
      data: revocationRecord
    };
  }

  async reviewRevocation(request: ReviewRequest): Promise<{
    success: boolean;
    message: string;
    data?: RevocationRecord;
  }> {
    const revocation = store.getRevocationById(request.revocationId);

    if (!revocation) {
      return {
        success: false,
        message: '撤销记录不存在'
      };
    }

    if (revocation.status !== CertificateStatus.REVOKING) {
      return {
        success: false,
        message: '该记录不处于待复核状态'
      };
    }

    const newStatus = request.approved
      ? CertificateStatus.REVOKED
      : CertificateStatus.ISSUED;

    store.updateCertificate(revocation.certificateId, { status: newStatus });

    const updatedRevocation = store.updateRevocation(request.revocationId, {
      status: newStatus,
      reviewComment: request.reviewComment
    });

    store.createRevocationRecord({
      certificateId: revocation.certificateId,
      certificateNo: revocation.certificateNo,
      courseId: revocation.courseId,
      courseName: revocation.courseName,
      studentId: revocation.studentId,
      studentName: revocation.studentName,
      employeeId: revocation.employeeId,
      reason: request.reviewComment,
      flow: RevocationFlow.MANUAL_REVIEW,
      status: newStatus,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      reviewComment: request.reviewComment
    });

    return {
      success: true,
      message: request.approved ? '人工复核通过，证书已撤销' : '人工复核驳回，证书已恢复',
      data: updatedRevocation || undefined
    };
  }

  async rejectRevocation(request: RejectRequest): Promise<{
    success: boolean;
    message: string;
    data?: RevocationRecord;
  }> {
    const revocation = store.getRevocationById(request.revocationId);

    if (!revocation) {
      return {
        success: false,
        message: '撤销记录不存在'
      };
    }

    store.updateCertificate(revocation.certificateId, {
      status: CertificateStatus.RESTORE_REQUESTED
    });

    const updatedRevocation = store.updateRevocation(request.revocationId, {
      status: CertificateStatus.RESTORE_REQUESTED,
      rejectReason: request.rejectReason,
      flow: RevocationFlow.REJECT
    });

    store.createRevocationRecord({
      certificateId: revocation.certificateId,
      certificateNo: revocation.certificateNo,
      courseId: revocation.courseId,
      courseName: revocation.courseName,
      studentId: revocation.studentId,
      studentName: revocation.studentName,
      employeeId: revocation.employeeId,
      reason: request.rejectReason,
      flow: RevocationFlow.REJECT,
      status: CertificateStatus.RESTORE_REQUESTED,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      rejectReason: request.rejectReason
    });

    return {
      success: true,
      message: '撤销申请已驳回',
      data: updatedRevocation || undefined
    };
  }

  async restoreCertificate(request: RestoreRequest): Promise<{
    success: boolean;
    message: string;
    data?: Certificate;
  }> {
    const certificate = store.getCertificateById(request.certificateId);

    if (!certificate) {
      return {
        success: false,
        message: '证书不存在'
      };
    }

    if (certificate.status !== CertificateStatus.RESTORE_REQUESTED) {
      return {
        success: false,
        message: '该证书不处于恢复申请状态'
      };
    }

    const updated = store.updateCertificate(request.certificateId, {
      status: CertificateStatus.ISSUED
    });

    store.createRevocationRecord({
      certificateId: certificate.id,
      certificateNo: certificate.certificateNo,
      courseId: certificate.courseId,
      courseName: certificate.courseName,
      studentId: certificate.studentId,
      studentName: certificate.studentName,
      employeeId: certificate.employeeId,
      reason: request.reason,
      flow: RevocationFlow.NORMAL,
      status: CertificateStatus.ISSUED,
      operatorId: request.operatorId,
      operatorName: request.operatorName
    });

    return {
      success: true,
      message: '证书已恢复',
      data: updated || undefined
    };
  }

  getRevocationList(params: PaginationParams & {
    status?: CertificateStatus;
    flow?: RevocationFlow;
    keyword?: string;
  }): PaginationResult<RevocationRecord> {
    let list = store.getAllRevocations();

    if (params.status) {
      list = list.filter(r => r.status === params.status);
    }

    if (params.flow) {
      list = list.filter(r => r.flow === params.flow);
    }

    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      list = list.filter(r =>
        r.certificateNo.toLowerCase().includes(kw) ||
        r.studentName.toLowerCase().includes(kw) ||
        r.courseName.toLowerCase().includes(kw)
      );
    }

    const total = list.length;
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    list = list.slice(start, end);

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize
    };
  }

  getRevocationDetail(id: string): RevocationRecord | null {
    return store.getRevocationById(id) || null;
  }

  getCertificateHistory(certificateId: string): RevocationRecord[] {
    return store.getCertificateHistory(certificateId);
  }

  getCertificateList(params: PaginationParams & {
    status?: CertificateStatus;
    keyword?: string;
  }): PaginationResult<Certificate> {
    let list = store.getAllCertificates();

    if (params.status) {
      list = list.filter(c => c.status === params.status);
    }

    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      list = list.filter(c =>
        c.certificateNo.toLowerCase().includes(kw) ||
        c.studentName.toLowerCase().includes(kw) ||
        c.courseName.toLowerCase().includes(kw)
      );
    }

    const total = list.length;
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    list = list.slice(start, end);

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize
    };
  }

  getCertificateDetail(id: string): Certificate | null {
    return store.getCertificateById(id) || null;
  }

  verifyCertificateExternal(certificateNo: string): {
    valid: boolean;
    message: string;
    data?: {
      certificateNo: string;
      courseName: string;
      studentName: string;
      issueDate: string;
      status: string;
    };
  } {
    const certificate = store.getCertificateByNo(certificateNo);

    if (!certificate) {
      return {
        valid: false,
        message: '证书不存在'
      };
    }

    return {
      valid: certificate.status !== CertificateStatus.REVOKED,
      message: certificate.status === CertificateStatus.REVOKED
        ? '证书已撤销'
        : '证书有效',
      data: {
        certificateNo: certificate.certificateNo,
        courseName: certificate.courseName,
        studentName: certificate.studentName,
        issueDate: certificate.issueDate,
        status: certificate.status
      }
    };
  }
}

export const revocationService = new RevocationService();
