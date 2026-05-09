import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9\u4e00-\u9fa5]/g, '');
}

export function dateToString(date: Date): string {
  return date.toISOString();
}

export function stringToDate(str: string): Date {
  return new Date(str);
}

export function formatCurrency(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function calculateDurationMinutes(entry: Date, exit: Date): number {
  return Math.max(0, Math.round((exit.getTime() - entry.getTime()) / 60000));
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
}

export function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    pending: '待处理',
    merging: '合并中',
    merged: '已合并',
    collecting: '追缴中',
    paid: '已结清',
    partially_paid: '部分结清',
    blacklisted: '已拉黑',
    withdrawn: '已撤回'
  };
  return translations[status] || status;
}

export function translatePaymentChannel(channel: string): string {
  const translations: Record<string, string> = {
    wechat: '微信支付',
    alipay: '支付宝',
    bank: '银行转账',
    cash: '现金',
    third_party: '第三方'
  };
  return translations[channel] || channel;
}

export function translateActionType(type: string): string {
  const translations: Record<string, string> = {
    notify: '首次通知',
    reminder: '再次提醒',
    legal_notice: '法务告知',
    blacklist: '加入黑名单',
    withdraw: '撤回操作'
  };
  return translations[type] || type;
}
