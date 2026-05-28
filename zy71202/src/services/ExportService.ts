import * as XLSX from 'xlsx';
import type { DisposalTask, CustomerPosition, TaskStatus, ReminderLog } from '@/types';
import { TIER_TEXT, CUSTOMER_TYPE_TEXT, RISK_LEVEL_TEXT } from './CustomerTierService';

export const TASK_STATUS_TEXT: Record<TaskStatus, string> = {
  PENDING_CONFIRM: '待确认',
  PROCESSING: '处理中',
  PROCESSED: '已处理',
  RETURNED: '需退回',
};

export const TASK_PRIORITY_TEXT = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

export const REMINDER_TYPE_TEXT = {
  SMS: '短信',
  EMAIL: '邮件',
  PHONE: '电话',
  SYSTEM: '系统',
};

export const REMINDER_STATUS_TEXT = {
  PENDING: '待发送',
  SENT: '已发送',
  FAILED: '发送失败',
  CANCELLED: '已取消',
};

export class ExportService {
  exportDisposalList(
    tasks: DisposalTask[],
    positions: CustomerPosition[],
    statusFilter: TaskStatus | 'ALL' = 'ALL'
  ): Blob {
    const filteredTasks = statusFilter === 'ALL' 
      ? tasks 
      : tasks.filter(t => t.status === statusFilter);
    
    const exportData = filteredTasks.flatMap(task => {
      const taskPositions = positions.filter(p => p.bondCode === task.bondCode);
      
      if (taskPositions.length === 0) {
        return [{
          '处置任务ID': task.id,
          '转债代码': task.bondCode,
          '转债名称': task.bondName,
          '任务状态': TASK_STATUS_TEXT[task.status],
          '优先级': TASK_PRIORITY_TEXT[task.priority as keyof typeof TASK_PRIORITY_TEXT],
          '客户ID': '',
          '客户名称': '',
          '客户类型': '',
          '客户分层': '',
          '风险等级': '',
          '持仓数量': 0,
          '持仓金额': 0,
          '成本价': 0,
          '盈亏': 0,
          '客户经理': '',
          '创建时间': task.createdAt,
          '退回原因': task.returnReason || '',
          '补材料要求': task.supplementRequirements || '',
        }];
      }
      
      return taskPositions.map(pos => ({
        '处置任务ID': task.id,
        '转债代码': task.bondCode,
        '转债名称': task.bondName,
        '任务状态': TASK_STATUS_TEXT[task.status],
        '优先级': TASK_PRIORITY_TEXT[task.priority as keyof typeof TASK_PRIORITY_TEXT],
        '客户ID': pos.customerId,
        '客户名称': pos.customerName,
        '客户类型': CUSTOMER_TYPE_TEXT[pos.customerType],
        '客户分层': TIER_TEXT[pos.tier],
        '风险等级': `${pos.riskLevel}(${RISK_LEVEL_TEXT[pos.riskLevel]})`,
        '持仓数量': pos.position,
        '持仓金额': pos.positionAmount,
        '成本价': pos.costPrice,
        '盈亏': pos.profitLoss,
        '客户经理': pos.accountManager,
        '创建时间': task.createdAt,
        '退回原因': task.returnReason || '',
        '补材料要求': task.supplementRequirements || '',
      }));
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '处置清单');
    
    const colWidths = [
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 6 },
      { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
      { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
      { wch: 20 }, { wch: 20 }, { wch: 20 },
    ];
    ws['!cols'] = colWidths;
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }
  
  exportReminderLogs(
    logs: ReminderLog[],
    bondCode?: string
  ): Blob {
    const filteredLogs = bondCode ? logs.filter(l => l.bondCode === bondCode) : logs;
    
    const exportData = filteredLogs.map(log => ({
      '提醒记录ID': log.id,
      '转债代码': log.bondCode,
      '客户ID': log.customerId,
      '客户名称': log.customerName,
      '提醒方式': REMINDER_TYPE_TEXT[log.reminderType as keyof typeof REMINDER_TYPE_TEXT],
      '提醒内容': log.reminderContent,
      '操作人ID': log.operatorId,
      '操作人': log.operatorName,
      '提醒时间': log.remindedAt,
      '状态': REMINDER_STATUS_TEXT[log.status as keyof typeof REMINDER_STATUS_TEXT],
      '幂等键': log.idempotencyKey,
      '关联任务ID': log.sourceTaskId,
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '提醒记录');
    
    const colWidths = [
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 8 },
      { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 8 },
      { wch: 30 }, { wch: 12 },
    ];
    ws['!cols'] = colWidths;
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }
  
  exportTriggerReport(
    bonds: Array<{
      bondCode: string;
      bondName: string;
      stockCode: string;
      stockName: string;
      redemptionPrice: number;
      stockPrice: number;
      meetDays30_15: number;
      meetDays20_10: number;
      isTriggered: boolean;
      hasGap: boolean;
      customerCount: number;
      totalPosition: number;
    }>
  ): Blob {
    const exportData = bonds.map(bond => ({
      '转债代码': bond.bondCode,
      '转债名称': bond.bondName,
      '正股代码': bond.stockCode,
      '正股名称': bond.stockName,
      '强赎触发价': bond.redemptionPrice,
      '当前正股价': bond.stockPrice,
      '涨跌幅(%)': (((bond.stockPrice - bond.redemptionPrice) / bond.redemptionPrice) * 100).toFixed(2),
      '30日达标天数': bond.meetDays30_15,
      '20日达标天数': bond.meetDays20_10,
      '是否触发': bond.isTriggered ? '是' : '否',
      '数据是否断档': bond.hasGap ? '是' : '否',
      '涉及客户数': bond.customerCount,
      '持仓总金额': bond.totalPosition,
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '强赎触发报告');
    
    const colWidths = [
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
      { wch: 12 }, { wch: 10 }, { wch: 14 },
    ];
    ws['!cols'] = colWidths;
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }
  
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
