import { v4 as uuidv4 } from 'uuid';
import {
  Student,
  Attendance,
  ExamScore,
  RetakeRecord,
  Certificate,
  StatusHistory,
  IdempotentRequest
} from './types';

class Database {
  private students: Map<string, Student> = new Map();
  private attendances: Map<string, Attendance> = new Map();
  private examScores: Map<string, ExamScore> = new Map();
  private retakeRecords: Map<string, RetakeRecord> = new Map();
  private certificates: Map<string, Certificate> = new Map();
  private statusHistories: Map<string, StatusHistory> = new Map();
  private idempotentRequests: Map<string, IdempotentRequest> = new Map();

  generateId(): string {
    return uuidv4();
  }

  getTimestamp(): string {
    return new Date().toISOString();
  }

  async addStatusHistory(
    entityType: StatusHistory['entityType'],
    entityId: string,
    fieldName: string,
    oldValue: any,
    newValue: any,
    changedBy: string,
    remark?: string
  ): Promise<void> {
    const history: StatusHistory = {
      id: this.generateId(),
      entityType,
      entityId,
      fieldName,
      oldValue,
      newValue,
      changedBy,
      changedAt: this.getTimestamp(),
      remark
    };
    this.statusHistories.set(history.id, history);
  }

  getStatusHistory(entityType?: StatusHistory['entityType'], entityId?: string): StatusHistory[] {
    let histories = Array.from(this.statusHistories.values());
    if (entityType) {
      histories = histories.filter(h => h.entityType === entityType);
    }
    if (entityId) {
      histories = histories.filter(h => h.entityId === entityId);
    }
    return histories.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  }

  getIdempotentRequest(requestId: string): IdempotentRequest | undefined {
    return this.idempotentRequests.get(requestId);
  }

  saveIdempotentRequest(request: IdempotentRequest): void {
    this.idempotentRequests.set(request.requestId, request);
  }

  getAllStudents(): Student[] {
    return Array.from(this.students.values());
  }

  getStudentById(id: string): Student | undefined {
    return this.students.get(id);
  }

  getStudentByIdCard(idCard: string): Student | undefined {
    return Array.from(this.students.values()).find(s => s.idCard === idCard);
  }

  createStudent(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>, operator: string): Student {
    const now = this.getTimestamp();
    const student: Student = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.students.set(student.id, student);
    return student;
  }

  updateStudent(id: string, data: Partial<Student>, operator: string): Student | undefined {
    const student = this.students.get(id);
    if (!student) return undefined;

    const oldStudent = { ...student };
    const now = this.getTimestamp();
    const updated = { ...student, ...data, updatedAt: now };
    
    Object.keys(data).forEach(key => {
      if (oldStudent[key as keyof Student] !== data[key as keyof Student]) {
        this.addStatusHistory('student', id, key, oldStudent[key as keyof Student], data[key as keyof Student], operator);
      }
    });

    this.students.set(id, updated);
    return updated;
  }

  getAllAttendances(): Attendance[] {
    return Array.from(this.attendances.values());
  }

  getAttendanceByStudentId(studentId: string): Attendance[] {
    return Array.from(this.attendances.values()).filter(a => a.studentId === studentId);
  }

  createAttendance(data: Omit<Attendance, 'id' | 'createdAt' | 'updatedAt'>, operator: string): Attendance {
    const now = this.getTimestamp();
    const attendance: Attendance = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.attendances.set(attendance.id, attendance);
    return attendance;
  }

  updateAttendance(id: string, data: Partial<Attendance>, operator: string): Attendance | undefined {
    const attendance = this.attendances.get(id);
    if (!attendance) return undefined;

    const oldAttendance = { ...attendance };
    const now = this.getTimestamp();
    const updated = { ...attendance, ...data, updatedAt: now };
    
    Object.keys(data).forEach(key => {
      if (oldAttendance[key as keyof Attendance] !== data[key as keyof Attendance]) {
        this.addStatusHistory('attendance', id, key, oldAttendance[key as keyof Attendance], data[key as keyof Attendance], operator);
      }
    });

    this.attendances.set(id, updated);
    return updated;
  }

  getAllExamScores(): ExamScore[] {
    return Array.from(this.examScores.values());
  }

  getExamScoreByStudentId(studentId: string): ExamScore[] {
    return Array.from(this.examScores.values()).filter(e => e.studentId === studentId);
  }

  createExamScore(data: Omit<ExamScore, 'id' | 'createdAt' | 'updatedAt' | 'isPassed'>, operator: string): ExamScore {
    const now = this.getTimestamp();
    const examScore: ExamScore = {
      ...data,
      id: this.generateId(),
      isPassed: data.score >= data.passScore,
      createdAt: now,
      updatedAt: now
    };
    this.examScores.set(examScore.id, examScore);
    return examScore;
  }

  updateExamScore(id: string, data: Partial<ExamScore>, operator: string): ExamScore | undefined {
    const examScore = this.examScores.get(id);
    if (!examScore) return undefined;

    const oldExamScore = { ...examScore };
    const now = this.getTimestamp();
    
    let isPassed = examScore.isPassed;
    if (data.score !== undefined || data.passScore !== undefined) {
      const newScore = data.score ?? examScore.score;
      const newPassScore = data.passScore ?? examScore.passScore;
      isPassed = newScore >= newPassScore;
    }
    
    const updated = { ...examScore, ...data, isPassed, updatedAt: now };
    
    Object.keys(data).forEach(key => {
      if (oldExamScore[key as keyof ExamScore] !== data[key as keyof ExamScore]) {
        this.addStatusHistory('examScore', id, key, oldExamScore[key as keyof ExamScore], data[key as keyof ExamScore], operator);
      }
    });

    if (isPassed !== oldExamScore.isPassed) {
      this.addStatusHistory('examScore', id, 'isPassed', oldExamScore.isPassed, isPassed, operator, '成绩状态自动更新');
    }

    this.examScores.set(id, updated);
    return updated;
  }

  getAllRetakeRecords(): RetakeRecord[] {
    return Array.from(this.retakeRecords.values());
  }

  getRetakeRecordByStudentId(studentId: string): RetakeRecord[] {
    return Array.from(this.retakeRecords.values()).filter(r => r.studentId === studentId);
  }

  createRetakeRecord(data: Omit<RetakeRecord, 'id' | 'createdAt' | 'updatedAt'>, operator: string): RetakeRecord {
    const now = this.getTimestamp();
    const retakeRecord: RetakeRecord = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.retakeRecords.set(retakeRecord.id, retakeRecord);
    return retakeRecord;
  }

  updateRetakeRecord(id: string, data: Partial<RetakeRecord>, operator: string): RetakeRecord | undefined {
    const retakeRecord = this.retakeRecords.get(id);
    if (!retakeRecord) return undefined;

    const oldRetakeRecord = { ...retakeRecord };
    const now = this.getTimestamp();
    const updated = { ...retakeRecord, ...data, updatedAt: now };
    
    Object.keys(data).forEach(key => {
      if (oldRetakeRecord[key as keyof RetakeRecord] !== data[key as keyof RetakeRecord]) {
        this.addStatusHistory('retake', id, key, oldRetakeRecord[key as keyof RetakeRecord], data[key as keyof RetakeRecord], operator);
      }
    });

    this.retakeRecords.set(id, updated);
    return updated;
  }

  getAllCertificates(): Certificate[] {
    return Array.from(this.certificates.values());
  }

  getCertificateById(id: string): Certificate | undefined {
    return this.certificates.get(id);
  }

  getCertificateByStudentId(studentId: string): Certificate | undefined {
    return Array.from(this.certificates.values()).find(c => c.studentId === studentId);
  }

  getCertificateByNo(certificateNo: string): Certificate | undefined {
    return Array.from(this.certificates.values()).find(c => c.certificateNo === certificateNo);
  }

  createCertificate(data: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>, operator: string): Certificate {
    const now = this.getTimestamp();
    const certificate: Certificate = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.certificates.set(certificate.id, certificate);
    return certificate;
  }

  updateCertificate(id: string, data: Partial<Certificate>, operator: string): Certificate | undefined {
    const certificate = this.certificates.get(id);
    if (!certificate) return undefined;

    const oldCertificate = { ...certificate };
    const now = this.getTimestamp();
    const updated = { ...certificate, ...data, updatedAt: now };
    
    Object.keys(data).forEach(key => {
      if (oldCertificate[key as keyof Certificate] !== data[key as keyof Certificate]) {
        this.addStatusHistory('certificate', id, key, oldCertificate[key as keyof Certificate], data[key as keyof Certificate], operator);
      }
    });

    this.certificates.set(id, updated);
    return updated;
  }

  revokeCertificate(id: string, reason: string, operator: string): Certificate | undefined {
    const certificate = this.certificates.get(id);
    if (!certificate) return undefined;

    const oldStatus = certificate.status;
    const now = this.getTimestamp();
    const updated = {
      ...certificate,
      status: 'revoked' as const,
      revokeDate: now,
      revokeReason: reason,
      revokedBy: operator,
      updatedAt: now
    };

    this.addStatusHistory('certificate', id, 'status', oldStatus, 'revoked', operator, reason);
    this.certificates.set(id, updated);
    return updated;
  }

  recheckCertificate(id: string, operator: string): Certificate | undefined {
    const certificate = this.certificates.get(id);
    if (!certificate) return undefined;

    const oldStatus = certificate.status;
    const now = this.getTimestamp();
    const updated = {
      ...certificate,
      status: 'rechecked' as const,
      recheckDate: now,
      recheckedBy: operator,
      updatedAt: now
    };

    this.addStatusHistory('certificate', id, 'status', oldStatus, 'rechecked', operator, '证书复核通过');
    this.certificates.set(id, updated);
    return updated;
  }
}

export const db = new Database();
