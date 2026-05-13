export interface Competition {
  id: string;
  name: string;
  organizer: string;
  date: string;
  level: 'national' | 'provincial' | 'school' | 'college';
}

export interface Student {
  id: string;
  name: string;
  studentId: string;
  className: string;
  grade: string;
  college: string;
}

export interface Award {
  id: string;
  competitionId: string;
  studentId: string;
  awardLevel: 'first' | 'second' | 'third' | 'excellence';
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface Certificate {
  id: string;
  certificateNo: string;
  awardId: string;
  studentId: string;
  studentName: string;
  issueDate: string;
  status: 'valid' | 'invalid' | 'reissued';
  isOriginal: boolean;
  reissueFrom?: string;
  printed: boolean;
  printedAt?: string;
}

export interface ReissueRequest {
  id: string;
  certificateId: string;
  awardId: string;
  studentId: string;
  originalName: string;
  correctedName?: string;
  reason: string;
  reasonCategory: 'name_error' | 'lost' | 'damaged' | 'other';
  receiver: string;
  receiverType: 'student' | 'teacher' | 'parent' | 'class_teacher';
  receiverPhone?: string;
  receiverIdCard?: string;
  classTeacherVerification?: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'blocked' | 'completed';
  blockerReason?: string;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
  operatorId?: string;
  newCertificateId?: string;
}

export interface CorrectionRecord {
  id: string;
  reissueRequestId: string;
  certificateId: string;
  oldCertificateNo: string;
  newCertificateNo?: string;
  oldName: string;
  newName: string;
  reason: string;
  createdAt: string;
  operatorId: string;
}

export type TabType = 'ledger' | 'reissue' | 'records';
export type FilterStatus = 'all' | 'pending' | 'completed' | 'blocked';
