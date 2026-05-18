import { createReadStream, ReadStream } from 'fs';
import { Parser } from 'json2csv';
import csvParser from 'csv-parser';
import { store } from '../store';
import {
  RevocationFlow,
  ImportStatus,
  ImportRecord,
  CertificateStatus
} from '../types';
import { revocationService } from './revocation.service';

export interface ImportResult {
  batchNo: string;
  total: number;
  success: number;
  failed: number;
  conflict: number;
  records: ImportRecord[];
}

export class ImportExportService {
  async importRevocations(
    filePath: string,
    operatorId: string,
    operatorName: string
  ): Promise<ImportResult> {
    const batchNo = 'BATCH-' + Date.now();
    const results: ImportRecord[] = [];
    let success = 0;
    let failed = 0;
    let conflict = 0;

    return new Promise((resolve, reject) => {
      createReadStream(filePath)
        .pipe(csvParser())
        .on('data', async (row: any) => {
          const rowNumber = results.length + 1;
          const certificateNo = row.certificateNo || row['证书编号'];
          const reason = row.reason || row['撤销原因'];

          if (!certificateNo) {
            failed++;
            results.push(store.createImportRecord({
              batchNo,
              rowNumber,
              certificateNo: '',
              reason: '',
              status: ImportStatus.FAILED,
              errorMessage: '缺少证书编号'
            }));
            return;
          }

          const certificate = store.getCertificateByNo(certificateNo);

          if (!certificate) {
            failed++;
            results.push(store.createImportRecord({
              batchNo,
              rowNumber,
              certificateNo,
              reason: reason || '',
              status: ImportStatus.FAILED,
              errorMessage: '证书不存在'
            }));
            return;
          }

          if (certificate.status === CertificateStatus.REVOKED) {
            conflict++;
            results.push(store.createImportRecord({
              batchNo,
              rowNumber,
              certificateNo,
              reason: reason || '',
              status: ImportStatus.CONFLICT,
              errorMessage: '证书已处于撤销状态'
            }));
            return;
          }

          if (certificate.status === CertificateStatus.REVOKING) {
            conflict++;
            results.push(store.createImportRecord({
              batchNo,
              rowNumber,
              certificateNo,
              reason: reason || '',
              status: ImportStatus.CONFLICT,
              errorMessage: '证书正在撤销中'
            }));
            return;
          }

          const revokeResult = await revocationService.revokeCertificate({
            certificateNo,
            reason: reason || '批量导入撤销',
            operatorId,
            operatorName,
            flow: RevocationFlow.NORMAL
          });

          if (revokeResult.success) {
            success++;
            results.push(store.createImportRecord({
              batchNo,
              rowNumber,
              certificateNo,
              reason: reason || '',
              status: ImportStatus.SUCCESS
            }));
          } else {
            failed++;
            results.push(store.createImportRecord({
              batchNo,
              rowNumber,
              certificateNo,
              reason: reason || '',
              status: ImportStatus.FAILED,
              errorMessage: revokeResult.message
            }));
          }
        })
        .on('end', () => {
          resolve({
            batchNo,
            total: results.length,
            success,
            failed,
            conflict,
            records: results
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async exportRevocations(filters?: {
    status?: CertificateStatus;
    flow?: RevocationFlow;
    startDate?: string;
    endDate?: string;
  }): Promise<string> {
    let records = store.getAllRevocations();

    if (filters?.status) {
      records = records.filter(r => r.status === filters.status);
    }

    if (filters?.flow) {
      records = records.filter(r => r.flow === filters.flow);
    }

    if (filters?.startDate) {
      records = records.filter(r => r.createdAt >= filters.startDate);
    }

    if (filters?.endDate) {
      records = records.filter(r => r.createdAt <= filters.endDate);
    }

    const fields = [
      { label: '证书编号', value: 'certificateNo' },
      { label: '课程名称', value: 'courseName' },
      { label: '学员姓名', value: 'studentName' },
      { label: '员工编号', value: 'employeeId' },
      { label: '撤销原因', value: 'reason' },
      { label: '处理流程', value: 'flow' },
      { label: '状态', value: 'status' },
      { label: '操作人', value: 'operatorName' },
      { label: '驳回原因', value: 'rejectReason' },
      { label: '复核意见', value: 'reviewComment' },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    return csv;
  }

  async exportCertificates(filters?: {
    status?: CertificateStatus;
  }): Promise<string> {
    let records = store.getAllCertificates();

    if (filters?.status) {
      records = records.filter(r => r.status === filters.status);
    }

    const fields = [
      { label: '证书编号', value: 'certificateNo' },
      { label: '课程ID', value: 'courseId' },
      { label: '课程名称', value: 'courseName' },
      { label: '学员ID', value: 'studentId' },
      { label: '学员姓名', value: 'studentName' },
      { label: '员工编号', value: 'employeeId' },
      { label: '发证日期', value: 'issueDate' },
      { label: '状态', value: 'status' },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    return csv;
  }

  getImportRecords(batchNo?: string): ImportRecord[] {
    if (batchNo) {
      return store.getImportRecordsByBatch(batchNo);
    }
    return store.getAllImportRecords();
  }
}

export const importExportService = new ImportExportService();
