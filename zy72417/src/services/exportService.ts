import * as XLSX from 'xlsx';
import { AuthorizationTerm, ChangeRecord, TunerMessage, WriteOffRecord } from '../types';
import dataSource from './dataSource';

export class ExportService {
  exportAuthorizationTerms(): { data: any[]; headers: string[] } {
    const terms = dataSource.getAuthorizationTerms('export');
    
    const exportData = terms.map(term => ({
      '原始行号': term.originalRowNumber,
      '乐队名称': term.bandName,
      '器材类型': term.equipmentType,
      '器材型号': term.equipmentModel,
      '授权开始日期': term.authorizationStartDate,
      '授权结束日期': term.authorizationEndDate,
      '授权地区（原始文本）': term.originalAuthorizedCitiesText,
      '授权地区（解析后）': term.authorizedCities.map(c => `${c.province}${c.city}`).join(', '),
      '维修费用（原价）': term.originalRepairFee,
      '维修费用（当前）': term.repairFee,
      '处理状态': this.getStatusText(term.status),
      '版本号': term.version,
      '创建人': term.createdBy,
      '创建时间': term.createdAt,
      '更新人': term.updatedBy,
      '更新时间': term.updatedAt
    }));

    const headers = Object.keys(exportData[0] || {});

    console.log(`[ExportService] 导出授权期限数据: ${exportData.length} 条, 数据源实例: ${dataSource.getInstanceId()}`);

    return { data: exportData, headers };
  }

  exportAuthorizationTermsWithEvidence(): { data: any[]; headers: string[] } {
    const terms = dataSource.getAuthorizationTerms('export');
    const allChanges = dataSource.getChangeRecords();
    const allMessages = dataSource.getTunerMessages();
    const allWriteOffs = dataSource.getWriteOffRecords();

    const exportData: any[] = [];

    for (const term of terms) {
      const changes = allChanges.filter(c => c.authorizationTermId === term.id);
      const messages = allMessages.filter(m => m.authorizationTermId === term.id);
      const writeOffs = allWriteOffs.filter(w => w.authorizationTermId === term.id);

      const baseRow: any = {
        '原始行号': term.originalRowNumber,
        '乐队名称': term.bandName,
        '器材型号': term.equipmentModel,
        '授权地区（原始）': term.originalAuthorizedCitiesText,
        '授权地区（当前）': term.authorizedCities.map(c => `${c.province}${c.city}`).join(', '),
        '维修费用（原始）': term.originalRepairFee,
        '维修费用（当前）': term.repairFee,
        '处理状态': this.getStatusText(term.status),
        '变更次数': changes.length,
        '调音师留言数': messages.length,
        '核销单数量': writeOffs.length,
        '数据版本': term.version
      };

      exportData.push(baseRow);

      if (changes.length > 0) {
        exportData.push({ '--- 变更记录 ---': '' });
        changes.forEach((change, idx) => {
          exportData.push({
            '变更序号': idx + 1,
            '变更字段': change.fieldName,
            '原值': change.oldValue,
            '新值': change.newValue,
            '变更人': change.changedBy,
            '变更时间': change.changedAt,
            '变更原因': change.changeReason,
            '版本': change.version
          });
        });
      }

      if (messages.length > 0) {
        exportData.push({ '--- 调音师留言 ---': '' });
        messages.forEach((msg, idx) => {
          exportData.push({
            '留言序号': idx + 1,
            '调音师': msg.tunerName,
            '留言内容': msg.content,
            '是否已查看': msg.isReviewed ? '是' : '否',
            '查看人': msg.reviewedBy || '',
            '查看时间': msg.reviewedAt || ''
          });
        });
      }

      exportData.push({ '': '' });
    }

    const headers = Array.from(new Set(exportData.flatMap(row => Object.keys(row))));

    console.log(`[ExportService] 导出带证据链的授权期限数据`);

    return { data: exportData, headers };
  }

  exportToExcel(filePath: string, includeEvidence: boolean = false): void {
    const { data, headers } = includeEvidence 
      ? this.exportAuthorizationTermsWithEvidence() 
      : this.exportAuthorizationTerms();

    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '授权期限明细');

    const summaryData = this.getSummaryData();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, '数据一致性校验');

    XLSX.writeFile(wb, filePath);
    console.log(`[ExportService] Excel文件已导出: ${filePath}`);
  }

  private getSummaryData(): any[] {
    const consistency = dataSource.verifyDataConsistency();
    const terms = dataSource.getAuthorizationTerms();
    
    return [
      { '检查项': '数据源实例ID', '结果': dataSource.getInstanceId() },
      { '检查项': '授权期限记录数', '结果': terms.length },
      { '检查项': '数据一致性', '结果': consistency.isConsistent ? '通过' : '不通过' },
      { '检查项': '一致性问题数', '结果': consistency.details.length },
      ...consistency.details.map((d, i) => ({ '检查项': `问题${i + 1}`, '结果': d }))
    ];
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '待处理',
      'imported': '已导入',
      'tuner_reviewed': '已查看留言',
      'verification_required': '待店长复核',
      'manager_reviewed': '店长已复核',
      'write_off_updated': '核销已更新',
      'completed': '已完成',
      'abnormal': '异常'
    };
    return statusMap[status] || status;
  }
}

export const exportService = new ExportService();
export default exportService;
