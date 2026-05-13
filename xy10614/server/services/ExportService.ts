import { store } from '../database/store';
import { ExportFilter, OperationLog, BlacklistRecord } from '../../shared/types';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

class ExportService {
  filterOperationLogs(filter: ExportFilter): OperationLog[] {
    let logs = store.getAllOperationLogs();

    if (filter.operator) {
      logs = logs.filter(l => l.operator === filter.operator);
    }

    if (filter.startTime) {
      logs = logs.filter(l => dayjs(l.createdAt).isAfter(dayjs(filter.startTime)));
    }

    if (filter.endTime) {
      logs = logs.filter(l => dayjs(l.createdAt).isBefore(dayjs(filter.endTime)));
    }

    if (filter.visitorId) {
      logs = logs.filter(l => l.visitorId === filter.visitorId);
    }

    if (filter.operationType) {
      logs = logs.filter(l => l.operationType === filter.operationType);
    }

    return logs;
  }

  getBlacklistChangeRecords(filter: ExportFilter): Array<{
    id: string;
    visitorName: string;
    visitorPhone: string;
    visitorIdCard?: string;
    action: 'add' | 'remove';
    operator: string;
    operationTime: string;
    reason: string;
    affectedRecords: string[];
  }> {
    const logs = this.filterOperationLogs(filter);
    const results: Array<any> = [];

    const blacklistLogs = logs.filter(l => 
      l.operationType === 'blacklist_add' || l.operationType === 'blacklist_remove'
    );

    blacklistLogs.forEach(log => {
      if (log.operationType === 'blacklist_add' && log.afterValue) {
        results.push({
          id: log.afterValue.id,
          visitorName: log.afterValue.visitorName,
          visitorPhone: log.afterValue.visitorPhone,
          visitorIdCard: log.afterValue.visitorIdCard,
          action: 'add' as const,
          operator: log.operator,
          operationTime: log.createdAt,
          reason: log.afterValue.reason,
          affectedRecords: log.afterValue.affectedRecords || []
        });
      } else if (log.operationType === 'blacklist_remove' && log.afterValue) {
        const blacklistRecord = store.getAllBlacklist().find(b => b.affectedRecords.includes(log.afterValue.id) || false);
        if (blacklistRecord) {
          results.push({
            id: blacklistRecord.id,
            visitorName: blacklistRecord.visitorName,
            visitorPhone: blacklistRecord.visitorPhone,
            visitorIdCard: blacklistRecord.visitorIdCard,
            action: 'remove' as const,
            operator: log.operator,
            operationTime: log.createdAt,
            reason: log.description.replace('移除黑名单：', '').split('，原因：')[1] || '',
            affectedRecords: blacklistRecord.affectedRecords
          });
        }
      }
    });

    return results;
  }

  exportToExcel(filter: ExportFilter): Buffer {
    const operationLogs = this.filterOperationLogs(filter);
    const blacklistChanges = this.getBlacklistChangeRecords(filter);

    const operationLogsData = operationLogs.map(log => ({
      '操作时间': dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      '操作人': log.operator,
      '操作人角色': log.operatorRole,
      '操作类型': this.getOperationTypeName(log.operationType),
      '访客ID': log.visitorId || '',
      '操作描述': log.description,
      '修改前': log.beforeValue ? JSON.stringify(log.beforeValue) : '',
      '修改后': log.afterValue ? JSON.stringify(log.afterValue) : ''
    }));

    const blacklistChangesData = blacklistChanges.map(change => ({
      '操作时间': dayjs(change.operationTime).format('YYYY-MM-DD HH:mm:ss'),
      '操作人': change.operator,
      '操作类型': change.action === 'add' ? '添加黑名单' : '移除黑名单',
      '访客姓名': change.visitorName,
      '访客手机号': change.visitorPhone,
      '访客身份证': change.visitorIdCard || '',
      '原因': change.reason,
      '影响记录数': change.affectedRecords.length,
      '影响记录ID': change.affectedRecords.join(', ')
    }));

    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(operationLogsData);
    XLSX.utils.book_append_sheet(wb, ws1, '操作日志');

    const ws2 = XLSX.utils.json_to_sheet(blacklistChangesData);
    XLSX.utils.book_append_sheet(wb, ws2, '黑名单变更记录');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  private getOperationTypeName(type: string): string {
    const nameMap: Record<string, string> = {
      'create': '创建',
      'update': '更新',
      'delete': '删除',
      'confirm': '确认',
      'reject': '拒绝',
      'check_in': '入园',
      'check_out': '离园',
      'manual_review': '人工复核',
      'blacklist_add': '添加黑名单',
      'blacklist_remove': '移除黑名单'
    };
    return nameMap[type] || type;
  }

  getDistinctOperators(): string[] {
    const logs = store.getAllOperationLogs();
    const operators = new Set(logs.map(l => l.operator));
    return Array.from(operators);
  }
}

export const exportService = new ExportService();
