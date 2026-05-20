export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

export function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    'pending': '待处理',
    'sent': '已寄送',
    'received': '已签收',
    'overdue': '超期未还',
    'damaged': '样品破损',
    'returned': '已归还',
    'deducted': '已扣款',
    'duplicate': '重复寄送',
    'rejected': '已拒绝'
  };
  return descriptions[status] || status;
}

export function isOverdue(expectedReturnDate: string, actualReturnDate?: string): boolean {
  if (actualReturnDate) return false;
  const expected = new Date(expectedReturnDate);
  const now = new Date();
  return now > expected;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}
