import { Bill, BillStatus, StatusHistoryItem } from '@/types/bill';
import { addDays, isBefore, isEqual, parseISO } from 'date-fns';

interface StateTransition {
  from: BillStatus[];
  to: BillStatus;
  condition: (bill: Bill) => boolean;
  action: string;
  reason: string;
}

const transitions: StateTransition[] = [
  {
    from: ['pending'],
    to: 'pledged',
    condition: (bill) => bill.pledgeStatus === '已质押' || bill.pledgeStatus === '质押中',
    action: '标记质押',
    reason: '质押状态更新为已质押'
  },
  {
    from: ['pending', 'pledged'],
    to: 'extended',
    condition: (bill) => !!bill.originalMaturityDate && bill.maturityDate !== bill.originalMaturityDate,
    action: '办理展期',
    reason: '票据已办理展期，到期日变更'
  },
  {
    from: ['pledged', 'extended'],
    to: 'matured',
    condition: (bill) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maturityDate = parseISO(bill.maturityDate);
      maturityDate.setHours(0, 0, 0, 0);
      return isEqual(maturityDate, today) || isBefore(maturityDate, today);
    },
    action: '到期处理',
    reason: '票据已到期'
  },
  {
    from: ['pledged', 'extended', 'matured'],
    to: 'released',
    condition: (bill) => !!bill.releaseApplication && bill.releaseApplication !== '',
    action: '释放保证金',
    reason: '收到释放申请，保证金已释放'
  },
  {
    from: ['matured'],
    to: 'to_confirm',
    condition: (bill) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maturityDate = parseISO(bill.maturityDate);
      maturityDate.setHours(0, 0, 0, 0);
      const overdueDate = addDays(maturityDate, 3);
      return isBefore(overdueDate, today) && !bill.releaseApplication;
    },
    action: '标记待确认',
    reason: '到期后3天仍未释放，需人工确认'
  },
  {
    from: ['released', 'to_confirm'],
    to: 'closed',
    condition: (bill) => bill.exceptions.every(e => e.confirmed) && !!bill.releaseApplication,
    action: '结清票据',
    reason: '所有异常已确认，保证金已释放，票据结清'
  }
];

export const canTransition = (bill: Bill, targetStatus: BillStatus): boolean => {
  const transition = transitions.find(t => t.to === targetStatus);
  return transition ? transition.from.includes(bill.status) : false;
};

export const getAvailableTransitions = (bill: Bill): { status: BillStatus; action: string; reason: string }[] => {
  return transitions
    .filter(t => t.from.includes(bill.status) && t.condition(bill))
    .map(t => ({ status: t.to, action: t.action, reason: t.reason }));
};

export const transitionBill = (
  bill: Bill, 
  targetStatus: BillStatus, 
  operator: string,
  customReason?: string
): Bill => {
  if (!canTransition(bill, targetStatus)) {
    throw new Error(`无法从 ${bill.status} 转换到 ${targetStatus}`);
  }

  const transition = transitions.find(t => t.to === targetStatus);
  const historyItem: StatusHistoryItem = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: targetStatus,
    timestamp: new Date().toISOString(),
    operator,
    reason: customReason || transition?.reason || '状态变更',
  };

  return {
    ...bill,
    status: targetStatus,
    statusHistory: [...bill.statusHistory, historyItem],
    updatedAt: new Date().toISOString(),
  };
};

export const autoTransition = (bill: Bill, operator: string): Bill => {
  let updatedBill = { ...bill };
  let hasChanges = true;

  while (hasChanges) {
    hasChanges = false;
    for (const transition of transitions) {
      if (transition.from.includes(updatedBill.status) && transition.condition(updatedBill)) {
        const historyItem: StatusHistoryItem = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: transition.to,
          timestamp: new Date().toISOString(),
          operator,
          reason: transition.reason,
        };
        updatedBill = {
          ...updatedBill,
          status: transition.to,
          statusHistory: [...updatedBill.statusHistory, historyItem],
          updatedAt: new Date().toISOString(),
        };
        hasChanges = true;
        break;
      }
    }
  }

  return updatedBill;
};

export const getStatusLabel = (status: BillStatus): string => {
  const labels: Record<BillStatus, string> = {
    pending: '待处理',
    pledged: '已质押',
    extended: '已展期',
    matured: '已到期',
    released: '已释放',
    to_confirm: '待确认',
    closed: '已结清',
  };
  return labels[status];
};

export const getStatusColorClass = (status: BillStatus): string => {
  const colors: Record<BillStatus, string> = {
    pending: 'bg-status-pending',
    pledged: 'bg-status-pledged',
    extended: 'bg-status-extended',
    matured: 'bg-status-matured',
    released: 'bg-status-released',
    to_confirm: 'bg-status-to_confirm',
    closed: 'bg-status-closed',
  };
  return colors[status];
};
