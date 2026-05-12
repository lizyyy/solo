import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const formatDateTime = (dateStr: string): string => {
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { locale: zhCN });
  } catch {
    return dateStr;
  }
};

export const formatDate = (dateStr: string): string => {
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd', { locale: zhCN });
  } catch {
    return dateStr;
  }
};

export const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    imported: '已导入',
    matched: '已匹配',
    pending_confirmation: '待确认',
    confirmed: '已确认',
    appealing: '申诉中',
    appeal_approved: '申诉通过',
    appeal_rejected: '申诉驳回',
    penalized: '已处罚',
    rolled_back: '已回滚',
  };
  return statusMap[status] || status;
};

export const getViolationTypeText = (type: string): string => {
  const typeMap: Record<string, string> = {
    speeding: '超速',
    red_light: '闯红灯',
    wrong_parking: '违停',
    lane_violation: '不按车道行驶',
    overload: '超载',
    other: '其他',
  };
  return typeMap[type] || type;
};

export const formatMoney = (amount: number): string => {
  return `¥${amount.toFixed(2)}`;
};
