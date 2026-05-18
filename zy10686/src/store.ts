import { v4 as uuidv4 } from 'uuid';
import {
  Certificate,
  RevocationRecord,
  ImportRecord,
  CertificateStatus,
  RevocationFlow,
  ImportStatus
} from './types';

class DataStore {
  private certificates: Map<string, Certificate> = new Map();
  private revocationRecords: Map<string, RevocationRecord> = new Map();
  private importRecords: Map<string, ImportRecord> = new Map();
  private certificateHistory: Map<string, RevocationRecord[]> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const now = new Date().toISOString();

    const sampleCertificates: Certificate[] = [
      {
        id: uuidv4(),
        certificateNo: 'CERT-2024-001',
        courseId: 'COURSE-001',
        courseName: '企业安全培训',
        studentId: 'STU-001',
        studentName: '张三',
        employeeId: 'EMP-001',
        issueDate: '2024-01-15',
        status: CertificateStatus.ISSUED,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        certificateNo: 'CERT-2024-002',
        courseId: 'COURSE-001',
        courseName: '企业安全培训',
        studentId: 'STU-002',
        studentName: '李四',
        employeeId: 'EMP-002',
        issueDate: '2024-01-16',
        status: CertificateStatus.REVOKED,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        certificateNo: 'CERT-2024-003',
        courseId: 'COURSE-002',
        courseName: '数据隐私保护',
        studentId: 'STU-003',
        studentName: '王五',
        employeeId: 'EMP-003',
        issueDate: '2024-02-01',
        status: CertificateStatus.REVOKING,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        certificateNo: 'CERT-2024-004',
        courseId: 'COURSE-002',
        courseName: '数据隐私保护',
        studentId: 'STU-004',
        studentName: '赵六',
        employeeId: 'EMP-004',
        issueDate: '2024-02-05',
        status: CertificateStatus.RESTORE_REQUESTED,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        certificateNo: 'CERT-2024-005',
        courseId: 'COURSE-003',
        courseName: '领导力培训',
        studentId: 'STU-005',
        studentName: '钱七',
        employeeId: 'EMP-005',
        issueDate: '2024-03-01',
        status: CertificateStatus.ISSUED,
        createdAt: now,
        updatedAt: now
      }
    ];

    sampleCertificates.forEach(cert => {
      this.certificates.set(cert.id, cert);
      this.certificateHistory.set(cert.id, []);
    });

    const sampleRevocations: RevocationRecord[] = [
      {
        id: uuidv4(),
        certificateId: sampleCertificates[1].id,
        certificateNo: 'CERT-2024-002',
        courseId: 'COURSE-001',
        courseName: '企业安全培训',
        studentId: 'STU-002',
        studentName: '李四',
        employeeId: 'EMP-002',
        reason: '考试作弊',
        flow: RevocationFlow.NORMAL,
        status: CertificateStatus.REVOKED,
        operatorId: 'OP-001',
        operatorName: '管理员',
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        certificateId: sampleCertificates[2].id,
        certificateNo: 'CERT-2024-003',
        courseId: 'COURSE-002',
        courseName: '数据隐私保护',
        studentId: 'STU-003',
        studentName: '王五',
        employeeId: 'EMP-003',
        reason: '成绩异常',
        flow: RevocationFlow.MANUAL_REVIEW,
        status: CertificateStatus.REVOKING,
        operatorId: 'OP-001',
        operatorName: '管理员',
        reviewComment: '待人工复核',
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        certificateId: sampleCertificates[3].id,
        certificateNo: 'CERT-2024-004',
        courseId: 'COURSE-002',
        courseName: '数据隐私保护',
        studentId: 'STU-004',
        studentName: '赵六',
        employeeId: 'EMP-004',
        reason: '误操作',
        flow: RevocationFlow.REJECT,
        status: CertificateStatus.RESTORE_REQUESTED,
        operatorId: 'OP-001',
        operatorName: '管理员',
        rejectReason: '撤销申请被驳回，已申请恢复',
        createdAt: now,
        updatedAt: now
      }
    ];

    sampleRevocations.forEach(record => {
      this.revocationRecords.set(record.id, record);
      const history = this.certificateHistory.get(record.certificateId) || [];
      history.push(record);
      this.certificateHistory.set(record.certificateId, history);
    });

    const batchNo = 'BATCH-' + Date.now();
    const sampleImports: ImportRecord[] = [
      {
        id: uuidv4(),
        batchNo,
        rowNumber: 1,
        certificateNo: 'CERT-2024-001',
        reason: '考试作弊',
        status: ImportStatus.SUCCESS,
        createdAt: now
      },
      {
        id: uuidv4(),
        batchNo,
        rowNumber: 2,
        certificateNo: 'CERT-2024-002',
        reason: '成绩异常',
        status: ImportStatus.CONFLICT,
        errorMessage: '证书已处于撤销状态',
        createdAt: now
      },
      {
        id: uuidv4(),
        batchNo,
        rowNumber: 3,
        certificateNo: 'INVALID-CERT',
        reason: '其他原因',
        status: ImportStatus.FAILED,
        errorMessage: '证书编号不存在',
        createdAt: now
      }
    ];

    sampleImports.forEach(record => {
      this.importRecords.set(record.id, record);
    });
  }

  getCertificateById(id: string): Certificate | undefined {
    return this.certificates.get(id);
  }

  getCertificateByNo(certificateNo: string): Certificate | undefined {
    return Array.from(this.certificates.values()).find(
      c => c.certificateNo === certificateNo
    );
  }

  getAllCertificates(): Certificate[] {
    return Array.from(this.certificates.values());
  }

  updateCertificate(id: string, updates: Partial<Certificate>): Certificate | null {
    const cert = this.certificates.get(id);
    if (!cert) return null;

    const updated = {
      ...cert,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.certificates.set(id, updated);
    return updated;
  }

  createRevocationRecord(data: Omit<RevocationRecord, 'id' | 'createdAt' | 'updatedAt'>): RevocationRecord {
    const now = new Date().toISOString();
    const record: RevocationRecord = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    this.revocationRecords.set(record.id, record);

    const history = this.certificateHistory.get(record.certificateId) || [];
    history.push(record);
    this.certificateHistory.set(record.certificateId, history);

    return record;
  }

  getRevocationById(id: string): RevocationRecord | undefined {
    return this.revocationRecords.get(id);
  }

  getRevocationByCertificateId(certificateId: string): RevocationRecord | undefined {
    return Array.from(this.revocationRecords.values()).find(
      r => r.certificateId === certificateId
    );
  }

  getAllRevocations(): RevocationRecord[] {
    return Array.from(this.revocationRecords.values());
  }

  updateRevocation(id: string, updates: Partial<RevocationRecord>): RevocationRecord | null {
    const record = this.revocationRecords.get(id);
    if (!record) return null;

    const updated = {
      ...record,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.revocationRecords.set(id, updated);
    return updated;
  }

  getCertificateHistory(certificateId: string): RevocationRecord[] {
    return this.certificateHistory.get(certificateId) || [];
  }

  createImportRecord(data: Omit<ImportRecord, 'id' | 'createdAt'>): ImportRecord {
    const record: ImportRecord = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    this.importRecords.set(record.id, record);
    return record;
  }

  getImportRecordsByBatch(batchNo: string): ImportRecord[] {
    return Array.from(this.importRecords.values()).filter(
      r => r.batchNo === batchNo
    );
  }

  getAllImportRecords(): ImportRecord[] {
    return Array.from(this.importRecords.values());
  }
}

export const store = new DataStore();
