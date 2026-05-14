import { create } from 'zustand';
import {
  Competition,
  Student,
  Award,
  Certificate,
  ReissueRequest,
  CorrectionRecord,
  FilterStatus
} from '../types';
import {
  competitions as mockCompetitions,
  students as mockStudents,
  awards as mockAwards,
  certificates as mockCertificates,
  reissueRequests as mockRequests,
  correctionRecords as mockRecords
} from '../data/mockData';

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

interface CertificateStore {
  competitions: Competition[];
  students: Student[];
  awards: Award[];
  certificates: Certificate[];
  reissueRequests: ReissueRequest[];
  correctionRecords: CorrectionRecord[];
  activeTab: 'ledger' | 'reissue' | 'records';
  filterStatus: FilterStatus;
  searchQuery: string;
  selectedRequest: ReissueRequest | null;
  showModal: boolean;
  modalType: 'approve' | 'detail' | 'create' | null;

  setActiveTab: (tab: 'ledger' | 'reissue' | 'records') => void;
  setFilterStatus: (status: FilterStatus) => void;
  setSearchQuery: (query: string) => void;
  setSelectedRequest: (request: ReissueRequest | null) => void;
  setShowModal: (show: boolean) => void;
  setModalType: (type: 'approve' | 'detail' | 'create' | null) => void;

  validateAwardVerified: (awardId: string) => ValidationResult;
  validateDuplicateReissue: (certificateId: string, excludeRequestId?: string) => ValidationResult;
  validateOldCertificateInvalid: (certificateId: string) => ValidationResult;
  validateClassTeacherVerification: (receiverType: string, verified?: boolean) => ValidationResult;
  validateAll: (request: Partial<ReissueRequest>) => ValidationResult;

  createReissueRequest: (request: Omit<ReissueRequest, 'id' | 'status' | 'createdAt'>) => void;
  approveRequest: (requestId: string) => void;
  rejectRequest: (requestId: string, reason: string) => void;
  completeRequest: (requestId: string, newCertificateNo: string) => void;
  unblockRequest: (requestId: string) => void;

  getFilteredRequests: () => ReissueRequest[];
  getStudentById: (id: string) => Student | undefined;
  getCompetitionById: (id: string) => Competition | undefined;
  getAwardById: (id: string) => Award | undefined;
  getCertificateById: (id: string) => Certificate | undefined;
  getCertificatesByStudentId: (studentId: string) => Certificate[];
}

export const useStore = create<CertificateStore>((set, get) => ({
  competitions: mockCompetitions,
  students: mockStudents,
  awards: mockAwards,
  certificates: mockCertificates,
  reissueRequests: mockRequests,
  correctionRecords: mockRecords,
  activeTab: 'ledger',
  filterStatus: 'all',
  searchQuery: '',
  selectedRequest: null,
  showModal: false,
  modalType: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedRequest: (request) => set({ selectedRequest: request }),
  setShowModal: (show) => set({ showModal: show }),
  setModalType: (type) => set({ modalType: type }),

  validateAwardVerified: (awardId) => {
    const award = get().awards.find(a => a.id === awardId);
    if (!award) return { valid: false, reason: '奖项不存在' };
    if (!award.verified) return { valid: false, reason: '奖项未复核，不能发证' };
    return { valid: true };
  },

  validateDuplicateReissue: (certificateId, excludeRequestId) => {
    const existingRequests = get().reissueRequests.filter(
      r => r.certificateId === certificateId &&
        r.id !== excludeRequestId &&
        ['pending', 'approved', 'completed'].includes(r.status)
    );
    if (existingRequests.length > 0) {
      return { valid: false, reason: '同一证书已有补发申请正在处理或已完成' };
    }
    return { valid: true };
  },

  validateOldCertificateInvalid: (certificateId) => {
    const certificate = get().certificates.find(c => c.id === certificateId);
    if (!certificate) return { valid: false, reason: '证书不存在' };
    return { valid: true };
  },

  validateClassTeacherVerification: (receiverType, verified) => {
    if (receiverType === 'class_teacher' && !verified) {
      return { valid: false, reason: '班主任代领缺少验证登记' };
    }
    return { valid: true };
  },

  validateAll: (request) => {
    const awardCheck = get().validateAwardVerified(request.awardId!);
    if (!awardCheck.valid) return awardCheck;

    const duplicateCheck = get().validateDuplicateReissue(request.certificateId!);
    if (!duplicateCheck.valid) return duplicateCheck;

    const oldCertCheck = get().validateOldCertificateInvalid(request.certificateId!);
    if (!oldCertCheck.valid) return oldCertCheck;

    const teacherCheck = get().validateClassTeacherVerification(
      request.receiverType!,
      request.classTeacherVerification
    );
    if (!teacherCheck.valid) return teacherCheck;

    return { valid: true };
  },

  createReissueRequest: (requestData) => {
    const validation = get().validateAll(requestData as ReissueRequest);
    
    const newRequest: ReissueRequest = {
      ...requestData,
      id: `req-${Date.now()}`,
      status: validation.valid ? 'pending' : 'blocked',
      createdAt: new Date().toISOString().split('T')[0],
      blockerReason: validation.valid ? undefined : validation.reason
    } as ReissueRequest;

    set(state => ({
      reissueRequests: [...state.reissueRequests, newRequest]
    }));
  },

  approveRequest: (requestId) => {
    set(state => ({
      reissueRequests: state.reissueRequests.map(r =>
        r.id === requestId
          ? { ...r, status: 'approved', approvedAt: new Date().toISOString().split('T')[0], operatorId: 'admin' }
          : r
      )
    }));
  },

  rejectRequest: (requestId, reason) => {
    set(state => ({
      reissueRequests: state.reissueRequests.map(r =>
        r.id === requestId
          ? { ...r, status: 'rejected', blockerReason: reason }
          : r
      )
    }));
  },

  completeRequest: (requestId, newCertificateNo) => {
    const request = get().reissueRequests.find(r => r.id === requestId);
    if (!request) return;

    const oldCertificate = get().certificates.find(c => c.id === request.certificateId);
    if (!oldCertificate) return;

    const newCertificateId = `cert-${Date.now()}`;
    const newCertificate: Certificate = {
      id: newCertificateId,
      certificateNo: newCertificateNo,
      awardId: request.awardId,
      studentId: request.studentId,
      studentName: request.correctedName || request.originalName,
      issueDate: new Date().toISOString().split('T')[0],
      status: 'valid',
      isOriginal: false,
      reissueFrom: request.certificateId,
      printed: true,
      printedAt: new Date().toISOString().split('T')[0]
    };

    const correctionRecord: CorrectionRecord = {
      id: `corr-${Date.now()}`,
      reissueRequestId: requestId,
      certificateId: request.certificateId,
      oldCertificateNo: oldCertificate.certificateNo,
      newCertificateNo: newCertificateNo,
      oldName: request.originalName,
      newName: request.correctedName || request.originalName,
      reason: request.reason,
      createdAt: new Date().toISOString().split('T')[0],
      operatorId: 'admin'
    };

    set(state => ({
      certificates: state.certificates.map(c =>
        c.id === request.certificateId
          ? { ...c, status: 'invalid' as const }
          : c
      ).concat(newCertificate),
      reissueRequests: state.reissueRequests.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: 'completed' as const,
              completedAt: new Date().toISOString().split('T')[0],
              newCertificateId: newCertificateId
            }
          : r
      ),
      correctionRecords: [...state.correctionRecords, correctionRecord]
    }));
  },

  unblockRequest: (requestId) => {
    set(state => ({
      reissueRequests: state.reissueRequests.map(r =>
        r.id === requestId
          ? { ...r, status: 'pending', blockerReason: undefined }
          : r
      )
    }));
  },

  getFilteredRequests: () => {
    const { reissueRequests, filterStatus, searchQuery, students } = get();
    let filtered = [...reissueRequests];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        const student = students.find(s => s.id === r.studentId);
        return (
          r.originalName.toLowerCase().includes(query) ||
          (student?.studentId.includes(query)) ||
          r.reason.toLowerCase().includes(query) ||
          r.receiver.toLowerCase().includes(query)
        );
      });
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getStudentById: (id) => get().students.find(s => s.id === id),
  getCompetitionById: (id) => get().competitions.find(c => c.id === id),
  getAwardById: (id) => get().awards.find(a => a.id === id),
  getCertificateById: (id) => get().certificates.find(c => c.id === id),
  getCertificatesByStudentId: (studentId) => get().certificates.filter(c => c.studentId === studentId)
}));
