import type { CreditRecord } from '../../shared/types';
import { unifiedResultRepository } from '../repositories/unifiedResultRepository';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

class ExportService {
  verifyConsistency(pageHash: string): boolean {
    const { records, dataHash } = unifiedResultRepository.getAllRecords();
    const exportData = this.prepareExportData(records);
    const exportHash = crypto
      .createHash('md5')
      .update(JSON.stringify(exportData))
      .digest('hex');
    
    return pageHash === dataHash && exportHash === dataHash;
  }

  getExportData(): { records: any[]; dataHash: string } {
    const { records, dataHash } = unifiedResultRepository.getAllRecords();
    return {
      records: this.prepareExportData(records),
      dataHash
    };
  }

  generateExcelBuffer(): { buffer: Buffer; dataHash: string } {
    const { records, dataHash } = this.getExportData();
    
    const worksheet = XLSX.utils.json_to_sheet(records.map(r => ({
      '记录ID': r.id,
      '机构代码': r.institutionCode,
      '原机构简称': r.institutionNamePrev,
      '当前机构简称': r.institutionNameCurrent,
      '机构简称一致': r.nameConsistent ? '是' : '否',
      '授信额度(元)': r.creditLine,
      '已占用(元)': r.occupiedAmount,
      '可用额度(元)': r.availableAmount,
      '除权日': r.exDividendDate,
      '配售比例': r.shareRatio,
      '总股数': r.totalShares,
      '是否有冲突': r.hasConflict ? '是' : '否',
      '冲突字段': r.conflictFields?.join(', ') || '',
      '状态': this.getStatusLabel(r.status),
      '复核状态': this.getReviewStatusLabel(r.reviewStatus),
      '导入时间': r.importTime,
      '更新时间': r.updateTime,
      '操作人': r.operator
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '授信额度明细');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return { buffer: Buffer.from(buffer), dataHash };
  }

  private prepareExportData(records: CreditRecord[]) {
    return records.map(r => ({
      id: r.id,
      institutionCode: r.institutionCode,
      institutionNamePrev: r.institutionNamePrev,
      institutionNameCurrent: r.institutionNameCurrent,
      nameConsistent: r.nameConsistent,
      creditLine: r.creditLine,
      occupiedAmount: r.occupiedAmount,
      availableAmount: r.availableAmount,
      exDividendDate: r.custodianData.exDividendDate,
      shareRatio: r.custodianData.shareRatio,
      totalShares: r.custodianData.totalShares,
      hasConflict: r.hasConflict,
      conflictFields: r.conflictFields,
      status: r.status,
      reviewStatus: r.reviewStatus,
      importTime: r.importTime,
      updateTime: r.updateTime,
      operator: r.operator
    }));
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: '待处理',
      imported: '已导入',
      abnormal: '机构简称异常',
      conflict: '数据冲突',
      resolved: '已处理待复核',
      reviewed: '已复核'
    };
    return labels[status] || status;
  }

  private getReviewStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: '待复核',
      approved: '已通过',
      rejected: '已驳回'
    };
    return labels[status] || status;
  }
}

export const exportService = new ExportService();
