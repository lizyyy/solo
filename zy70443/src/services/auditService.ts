import { get, all, run } from '../database';
import { AuditResult, AuditBatch, Certificate, BusBooking } from '../types';
import crypto from 'crypto';

export function generateBatchId(): string {
  return `BATCH-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function detectTimeOrderAnomaly(certificates: Certificate[]): number[] {
  const anomalyIds: number[] = [];
  for (let i = 0; i < certificates.length - 1; i++) {
    const current = new Date(certificates[i].createdAt);
    const next = new Date(certificates[i + 1].createdAt);
    if (current < next) {
      const id = certificates[i].id;
      if (id !== undefined) {
        anomalyIds.push(id);
      }
    }
  }
  return anomalyIds;
}

export interface AuditRecordResult {
  recordId: number;
  originalLineNo: number;
  recordType: 'certificate' | 'bus_booking';
  status: 'success' | 'failed' | 'warning';
  errorCode?: string;
  errorMessage?: string;
  beforeData: string;
  afterData?: string;
  remarks?: string;
}

export async function auditCertificates(batchId: string): Promise<{
  results: AuditRecordResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
    warning: number;
  };
}> {
  const certificates = await all<Certificate>('SELECT * FROM certificates ORDER BY id');
  
  const results: AuditRecordResult[] = [];
  let success = 0, failed = 0, warning = 0;

  for (let index = 0; index < certificates.length; index++) {
    const cert = certificates[index];
    const beforeData = JSON.stringify({
      certificateNo: cert.certificateNo,
      applicant: cert.applicant,
      issueDate: cert.issueDate,
      status: cert.status,
      createdAt: cert.createdAt,
    });

    const originalLineNo = index + 1;
    const createTime = new Date(cert.createdAt).getTime();
    const issueTime = new Date(cert.issueDate).getTime();
    
    if (createTime > issueTime) {
      warning++;
      results.push({
        recordId: cert.id!,
        originalLineNo,
        recordType: 'certificate',
        status: 'warning',
        errorCode: 'TIME_ANOMALY',
        errorMessage: '证书创建时间晚于签发时间，存在时间顺序异常',
        beforeData,
        remarks: '需要复核签发流程的时间记录',
      });
    } else if (cert.status === 'pending') {
      await run(
        'UPDATE certificates SET status = ?, updatedAt = ? WHERE id = ?',
        ['issued', new Date().toISOString(), cert.id]
      );
      success++;
      results.push({
        recordId: cert.id!,
        originalLineNo,
        recordType: 'certificate',
        status: 'success',
        beforeData,
        afterData: JSON.stringify({ status: 'issued', updatedAt: new Date().toISOString() }),
        remarks: '待签发证书已完成签发',
      });
    } else {
      success++;
      results.push({
        recordId: cert.id!,
        originalLineNo,
        recordType: 'certificate',
        status: 'success',
        beforeData,
        remarks: '证书状态正常',
      });
    }
  }

  return {
    results,
    summary: { total: certificates.length, success, failed, warning },
  };
}

export async function auditBusBookings(batchId: string): Promise<{
  results: AuditRecordResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
    warning: number;
  };
}> {
  const bookings = await all<BusBooking>('SELECT * FROM bus_bookings ORDER BY originalLineNo');
  
  const results: AuditRecordResult[] = [];
  let success = 0, failed = 0, warning = 0;

  for (const booking of bookings) {
    const beforeData = JSON.stringify({
      employeeName: booking.employeeName,
      employeeId: booking.employeeId,
      route: booking.route,
      bookingDate: booking.bookingDate,
      manualRemark: booking.manualRemark,
    });

    if (booking.manualRemark && booking.manualRemark.length > 0) {
      warning++;
      results.push({
        recordId: booking.id!,
        originalLineNo: booking.originalLineNo,
        recordType: 'bus_booking',
        status: 'warning',
        errorCode: 'HAS_MANUAL_REMARK',
        errorMessage: `含有人工备注需要复核: ${booking.manualRemark}`,
        beforeData,
        remarks: booking.manualRemark,
      });
    } else {
      success++;
      results.push({
        recordId: booking.id!,
        originalLineNo: booking.originalLineNo,
        recordType: 'bus_booking',
        status: 'success',
        beforeData,
        remarks: '预约信息正常',
      });
    }
  }

  return {
    results,
    summary: { total: bookings.length, success, failed, warning },
  };
}

export async function saveAuditBatch(
  batchId: string,
  certResults: AuditRecordResult[],
  bookingResults: AuditRecordResult[],
  executionTimeMs: number,
  startTime: string,
  endTime: string
): Promise<AuditBatch> {
  const allResults = [...certResults, ...bookingResults];
  const totalCount = allResults.length;
  const successCount = allResults.filter(r => r.status === 'success').length;
  const failedCount = allResults.filter(r => r.status === 'failed').length;
  const warningCount = allResults.filter(r => r.status === 'warning').length;
  
  let status: 'completed' | 'partial' | 'failed' = 'completed';
  if (failedCount > 0) {
    status = 'failed';
  } else if (warningCount > 0) {
    status = 'partial';
  }

  const createdAt = new Date().toISOString();
  await run(
    'INSERT INTO audit_batches (batchId, totalCount, successCount, failedCount, warningCount, startTime, endTime, executionTimeMs, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [batchId, totalCount, successCount, failedCount, warningCount, startTime, endTime, executionTimeMs, status, createdAt]
  );

  for (const result of allResults) {
    await run(
      'INSERT INTO audit_results (batchId, recordId, recordType, originalLineNo, status, errorCode, errorMessage, beforeData, afterData, remarks, executedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        batchId, result.recordId, result.recordType, result.originalLineNo,
        result.status, result.errorCode || null, result.errorMessage || null,
        result.beforeData, result.afterData || null, result.remarks || null,
        new Date().toISOString()
      ]
    );
  }

  const batch = await get<AuditBatch>('SELECT * FROM audit_batches WHERE batchId = ?', [batchId]);
  return batch!;
}

export async function getAuditBatch(batchId: string): Promise<AuditBatch | undefined> {
  return await get<AuditBatch>('SELECT * FROM audit_batches WHERE batchId = ?', [batchId]);
}

export async function getAuditResults(batchId: string): Promise<AuditResult[]> {
  return await all<AuditResult>('SELECT * FROM audit_results WHERE batchId = ? ORDER BY id', [batchId]);
}

export async function getAllAuditBatches(): Promise<AuditBatch[]> {
  return await all<AuditBatch>('SELECT * FROM audit_batches ORDER BY createdAt DESC');
}
