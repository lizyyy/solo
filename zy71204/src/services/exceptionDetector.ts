import { Bill, ExceptionItem, ExceptionType, ExceptionSeverity } from '@/types/bill';
import { isBefore, parseISO, differenceInDays } from 'date-fns';

interface ExceptionRule {
  type: ExceptionType;
  severity: ExceptionSeverity;
  check: (bill: Bill, allBills: Bill[]) => boolean;
  generateMessage: (bill: Bill) => string;
  explanation: (bill: Bill) => string;
}

const rules: ExceptionRule[] = [
  {
    type: 'overdue_not_released',
    severity: 'high',
    check: (bill) => {
      if (bill.status === 'released' || bill.status === 'closed') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maturityDate = parseISO(bill.maturityDate);
      maturityDate.setHours(0, 0, 0, 0);
      const overdueDays = differenceInDays(today, maturityDate);
      return overdueDays > 0 && !bill.releaseApplication;
    },
    generateMessage: (bill) => `票据${bill.billNo}已到期但未释放`,
    explanation: (bill) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maturityDate = parseISO(bill.maturityDate);
      maturityDate.setHours(0, 0, 0, 0);
      const overdueDays = differenceInDays(today, maturityDate);
      return `到期日为 ${bill.maturityDate}，已逾期 ${overdueDays} 天，但尚未收到释放申请。请联系银行确认释放状态或补传释放回单。`;
    }
  },
  {
    type: 'extended_still_matured',
    severity: 'high',
    check: (bill) => {
      if (!bill.originalMaturityDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newMaturityDate = parseISO(bill.maturityDate);
      newMaturityDate.setHours(0, 0, 0, 0);
      return isBefore(newMaturityDate, today) && bill.status === 'extended';
    },
    generateMessage: (bill) => `展期票据${bill.billNo}在新到期日后仍提示到期`,
    explanation: (bill) => {
      return `原始到期日为 ${bill.originalMaturityDate}，展期后到期日为 ${bill.maturityDate}。当前新到期日已过但票据状态仍为已展期，系统自动转为到期状态。请核实展期是否生效或是否需要再次展期。`;
    }
  },
  {
    type: 'duplicate_pledged',
    severity: 'high',
    check: (bill, allBills) => {
      const sameBillNo = allBills.filter(b => 
        b.billNo === bill.billNo && 
        b.id !== bill.id &&
        (b.pledgeStatus === '已质押' || b.pledgeStatus === '质押中') &&
        !b.isDirty
      );
      return sameBillNo.length > 0 && (bill.pledgeStatus === '已质押' || bill.pledgeStatus === '质押中');
    },
    generateMessage: (bill) => `票据${bill.billNo}存在重复质押记录`,
    explanation: (bill) => {
      return `系统检测到同一票据编号 ${bill.billNo} 存在多条质押记录。这可能是由于重复导入或实际业务中的重复质押。请核实业务真实性，确认是数据重复还是真实的多次质押操作。`;
    }
  },
  {
    type: 'data_inconsistency',
    severity: 'medium',
    check: (bill) => {
      if (bill.status === 'released' && !bill.releaseApplication) {
        return true;
      }
      if (bill.releaseApplication && bill.status !== 'released' && bill.status !== 'closed') {
        return true;
      }
      return false;
    },
    generateMessage: (bill) => `票据${bill.billNo}数据状态不一致`,
    explanation: (bill) => {
      if (bill.status === 'released' && !bill.releaseApplication) {
        return '票据状态为已释放，但缺少释放申请记录。请补传释放回单以保证数据完整性。';
      }
      if (bill.releaseApplication && bill.status !== 'released' && bill.status !== 'closed') {
        return `已有释放申请（${bill.releaseApplication}），但票据状态仍为 ${bill.status}。系统将自动触发释放流程。`;
      }
      return '数据状态存在不一致，请人工核实。';
    }
  }
];

export const detectExceptions = (bill: Bill, allBills: Bill[]): ExceptionItem[] => {
  const exceptions: ExceptionItem[] = [];

  for (const rule of rules) {
    if (rule.check(bill, allBills)) {
      const existingException = bill.exceptions.find(
        e => e.type === rule.type && !e.confirmed
      );
      
      if (!existingException) {
        exceptions.push({
          id: `exc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: rule.type,
          severity: rule.severity,
          message: rule.generateMessage(bill),
          detectedAt: new Date().toISOString(),
          confirmed: false,
          explanation: rule.explanation(bill),
        });
      }
    }
  }

  return exceptions;
};

export const checkAllBillsForExceptions = (bills: Bill[]): Bill[] => {
  return bills.map(bill => {
    const newExceptions = detectExceptions(bill, bills);
    if (newExceptions.length > 0) {
      const updatedBill = {
        ...bill,
        exceptions: [
          ...bill.exceptions.filter(e => e.confirmed || !newExceptions.find(ne => ne.type === e.type)),
          ...newExceptions
        ],
        updatedAt: new Date().toISOString(),
      };

      const hasHighSeverity = newExceptions.some(e => e.severity === 'high');
      if (hasHighSeverity && bill.status !== 'to_confirm' && bill.status !== 'closed') {
        updatedBill.status = 'to_confirm';
        updatedBill.statusHistory = [
          ...bill.statusHistory,
          {
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'to_confirm' as const,
            timestamp: new Date().toISOString(),
            operator: 'SYSTEM',
            reason: '检测到高优先级异常，标记待确认',
          }
        ];
      }

      return updatedBill;
    }
    return bill;
  });
};

export const getExceptionTypeLabel = (type: ExceptionType): string => {
  const labels: Record<ExceptionType, string> = {
    overdue_not_released: '到期未释放',
    extended_still_matured: '展期后仍到期',
    duplicate_pledged: '重复质押',
    data_inconsistency: '数据不一致',
  };
  return labels[type];
};

export const getSeverityLabel = (severity: ExceptionSeverity): string => {
  const labels: Record<ExceptionSeverity, string> = {
    high: '高风险',
    medium: '中风险',
    low: '低风险',
  };
  return labels[severity];
};

export const confirmException = (
  bill: Bill, 
  exceptionId: string, 
  operator: string,
  notes?: string
): Bill => {
  return {
    ...bill,
    exceptions: bill.exceptions.map(e => 
      e.id === exceptionId
        ? {
            ...e,
            confirmed: true,
            confirmedBy: operator,
            confirmedAt: new Date().toISOString(),
            explanation: notes || e.explanation,
          }
        : e
    ),
    updatedAt: new Date().toISOString(),
  };
};
