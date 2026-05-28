import { Bill } from '@/types/bill';
import { parseISO, differenceInDays } from 'date-fns';

export interface OccupancyBreakdown {
  billNo: string;
  baseMargin: number;
  statusAdjustment: number;
  exceptionAdjustment: number;
  finalOccupancy: number;
  calculationDetails: string[];
}

const getStatusMultiplier = (status: Bill['status']): number => {
  const multipliers: Record<Bill['status'], number> = {
    pending: 1.0,
    pledged: 1.0,
    extended: 0.95,
    matured: 1.1,
    released: 0,
    to_confirm: 1.2,
    closed: 0,
  };
  return multipliers[status];
};

const getExceptionMultiplier = (bill: Bill): number => {
  const unconfirmedHigh = bill.exceptions.filter(e => !e.confirmed && e.severity === 'high').length;
  const unconfirmedMedium = bill.exceptions.filter(e => !e.confirmed && e.severity === 'medium').length;
  
  return 1 + (unconfirmedHigh * 0.1) + (unconfirmedMedium * 0.05);
};

export const calculateBillOccupancy = (bill: Bill): OccupancyBreakdown => {
  const details: string[] = [];
  const baseMargin = bill.margin;
  
  details.push(`基础保证金: ${baseMargin.toLocaleString()} 元`);
  
  const statusMultiplier = getStatusMultiplier(bill.status);
  const statusAdjustment = baseMargin * (statusMultiplier - 1);
  if (statusMultiplier !== 1) {
    details.push(`状态调整 (${bill.status}): ${statusAdjustment >= 0 ? '+' : ''}${statusAdjustment.toLocaleString()} 元 (系数: ${statusMultiplier})`);
  }
  
  const exceptionMultiplier = getExceptionMultiplier(bill);
  const afterStatus = baseMargin * statusMultiplier;
  const exceptionAdjustment = afterStatus * (exceptionMultiplier - 1);
  if (exceptionMultiplier !== 1) {
    details.push(`异常调整: ${exceptionAdjustment >= 0 ? '+' : ''}${exceptionAdjustment.toLocaleString()} 元 (系数: ${exceptionMultiplier})`);
  }
  
  const finalOccupancy = baseMargin * statusMultiplier * exceptionMultiplier;
  
  details.push(`最终占用: ${finalOccupancy.toLocaleString()} 元`);
  
  return {
    billNo: bill.billNo,
    baseMargin,
    statusAdjustment,
    exceptionAdjustment,
    finalOccupancy,
    calculationDetails: details,
  };
};

export const recalculateAllOccupancy = (bills: Bill[]): { bills: Bill[]; totalOccupancy: number } => {
  let totalOccupancy = 0;
  
  const updatedBills = bills.map(bill => {
    const breakdown = calculateBillOccupancy(bill);
    totalOccupancy += breakdown.finalOccupancy;
    
    return {
      ...bill,
      calculatedOccupancy: breakdown.finalOccupancy,
      updatedAt: new Date().toISOString(),
    };
  });
  
  return { bills: updatedBills, totalOccupancy };
};

export const getMaturityWarningLevel = (bill: Bill): 'none' | 'low' | 'medium' | 'high' | 'overdue' => {
  if (bill.status === 'released' || bill.status === 'closed') {
    return 'none';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maturityDate = parseISO(bill.maturityDate);
  maturityDate.setHours(0, 0, 0, 0);
  
  const daysUntilMaturity = differenceInDays(maturityDate, today);
  
  if (daysUntilMaturity < 0) {
    return 'overdue';
  } else if (daysUntilMaturity === 0) {
    return 'high';
  } else if (daysUntilMaturity <= 3) {
    return 'medium';
  } else if (daysUntilMaturity <= 7) {
    return 'low';
  }
  
  return 'none';
};

export const getMaturityWarningText = (level: ReturnType<typeof getMaturityWarningLevel>): string => {
  const texts = {
    none: '',
    low: '7天内到期',
    medium: '3天内到期',
    high: '今日到期',
    overdue: '已逾期',
  };
  return texts[level];
};

export const getRiskScore = (bill: Bill): { score: number; level: 'low' | 'medium' | 'high'; factors: string[] } => {
  let score = 50;
  const factors: string[] = [];
  
  const maturityLevel = getMaturityWarningLevel(bill);
  if (maturityLevel === 'overdue') {
    score += 25;
    factors.push('已逾期');
  } else if (maturityLevel === 'high') {
    score += 15;
    factors.push('今日到期');
  } else if (maturityLevel === 'medium') {
    score += 10;
    factors.push('3天内到期');
  } else if (maturityLevel === 'low') {
    score += 5;
    factors.push('7天内到期');
  }
  
  const highExceptions = bill.exceptions.filter(e => !e.confirmed && e.severity === 'high').length;
  const mediumExceptions = bill.exceptions.filter(e => !e.confirmed && e.severity === 'medium').length;
  
  if (highExceptions > 0) {
    score += highExceptions * 15;
    factors.push(`${highExceptions}个高优先级异常`);
  }
  if (mediumExceptions > 0) {
    score += mediumExceptions * 8;
    factors.push(`${mediumExceptions}个中优先级异常`);
  }
  
  if (bill.status === 'to_confirm') {
    score += 15;
    factors.push('状态待确认');
  } else if (bill.status === 'matured') {
    score += 10;
    factors.push('已到期');
  }
  
  score = Math.min(100, Math.max(0, score));
  
  let level: 'low' | 'medium' | 'high' = 'low';
  if (score >= 70) level = 'high';
  else if (score >= 40) level = 'medium';
  
  return { score, level, factors: factors.length > 0 ? factors : ['无风险因素'] };
};
