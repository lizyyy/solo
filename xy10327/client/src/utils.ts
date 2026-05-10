import { BookingStatus } from './types';
import dayjs from 'dayjs';

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: '待确认',
  confirmed: '已预约',
  checked_in: '已签到',
  in_use: '使用中',
  completed: '已完成',
  late_released: '迟到释放',
  cancelled: '已取消',
  room_changed: '已换房'
};

export const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'orange',
  confirmed: 'blue',
  checked_in: 'cyan',
  in_use: 'green',
  completed: 'default',
  late_released: 'red',
  cancelled: 'default',
  room_changed: 'purple'
};

export const VIP_LABELS: Record<string, string> = {
  normal: '普通会员',
  silver: '银卡',
  gold: '金卡',
  platinum: '白金卡'
};

export function formatDateTime(isoString: string): string {
  return dayjs(isoString).format('YYYY-MM-DD HH:mm');
}

export function formatTime(isoString: string): string {
  return dayjs(isoString).format('HH:mm');
}

export function formatDate(isoString: string): string {
  return dayjs(isoString).format('YYYY-MM-DD');
}

export function getDuration(startTime: string, endTime: string): string {
  const start = dayjs(startTime);
  const end = dayjs(endTime);
  const hours = end.diff(start, 'hour', true);
  if (hours < 1) {
    return `${end.diff(start, 'minute')}分钟`;
  }
  return `${hours.toFixed(1)}小时`;
}

export function exportToCSV(bookings: any[], filename: string = 'bookings.csv') {
  const headers = [
    '预约编号',
    '顾客姓名',
    '联系电话',
    '琴房',
    '开始时间',
    '结束时间',
    '状态',
    '总金额',
    '已付金额',
    '是否续时',
    '备注',
    '创建时间'
  ];
  
  const rows = bookings.map(b => [
    b.id,
    b.customerName,
    b.customerPhone,
    b.roomId,
    formatDateTime(b.startTime),
    formatDateTime(b.endTime),
    STATUS_LABELS[b.status],
    b.totalPrice,
    b.paidAmount,
    b.isExtended ? '是' : '否',
    b.notes || '',
    formatDateTime(b.createdAt)
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
  ].join('\n');
  
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
