import { PayloadPlan, FaultRecord, OrbitElement, DailyBudget, BudgetStatus, TimeSystem } from '../types';
import { parseTimeWithSystem, isSameDay, getDateOnly } from './timeConverter';

const DAILY_BUDGET_THRESHOLD = 2400;
const WARNING_MARGIN = 400;

interface ShadowPeriod {
  start: Date;
  end: Date;
  powerReduction: number;
}

function calculateShadowPeriods(orbitElements: OrbitElement[], date: string): ShadowPeriod[] {
  const periods: ShadowPeriod[] = [];
  const targetDate = new Date(date);
  
  orbitElements.forEach(element => {
    const effectiveDate = parseTimeWithSystem(element.effectiveTime, element.timeSystem);
    if (isSameDay(effectiveDate, targetDate) && element.parameterName === 'eclipse') {
      const duration = Math.abs(element.newValue - element.oldValue) / 60;
      periods.push({
        start: effectiveDate,
        end: new Date(effectiveDate.getTime() + duration * 60 * 1000),
        powerReduction: 50
      });
    }
  });
  
  return periods;
}

function calculatePayloadEnergy(plan: PayloadPlan, date: string): number {
  const targetDate = new Date(date);
  const startDate = parseTimeWithSystem(plan.startTime, plan.timeSystem);
  const endDate = parseTimeWithSystem(plan.endTime, plan.timeSystem);
  
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setUTCHours(23, 59, 59, 999);
  
  const effectiveStart = new Date(Math.max(startDate.getTime(), dayStart.getTime()));
  const effectiveEnd = new Date(Math.min(endDate.getTime(), dayEnd.getTime()));
  
  if (effectiveEnd <= effectiveStart) return 0;
  
  const durationHours = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
  return plan.powerConsumption * durationHours;
}

function calculateFaultEnergy(record: FaultRecord, date: string): number {
  const targetDate = new Date(date);
  const faultDate = parseTimeWithSystem(record.faultTime, record.timeSystem);
  
  if (!isSameDay(faultDate, targetDate)) return 0;
  
  const durationHours = record.duration / 60;
  return record.powerIncrement * durationHours;
}

export function calculateDailyBudget(
  date: string,
  payloadPlans: PayloadPlan[],
  faultRecords: FaultRecord[],
  orbitElements: OrbitElement[],
  anomalies: { status: string }[]
): DailyBudget {
  let actualConsumption = 0;
  
  payloadPlans.forEach(plan => {
    actualConsumption += calculatePayloadEnergy(plan, date);
  });
  
  faultRecords.forEach(record => {
    actualConsumption += calculateFaultEnergy(record, date);
  });
  
  const shadowPeriods = calculateShadowPeriods(orbitElements, date);
  let shadowReduction = 0;
  shadowPeriods.forEach(period => {
    const durationHours = (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60);
    shadowReduction += period.powerReduction * durationHours;
  });
  
  actualConsumption -= shadowReduction;
  actualConsumption = Math.max(0, actualConsumption);
  
  const totalBudget = DAILY_BUDGET_THRESHOLD;
  const margin = totalBudget - actualConsumption;
  
  let status: BudgetStatus = 'NORMAL';
  if (margin < 0) {
    status = 'ERROR';
  } else if (margin < WARNING_MARGIN) {
    status = 'WARNING';
  }
  
  const dayPayloads = payloadPlans.filter(p => {
    const d = parseTimeWithSystem(p.startTime, p.timeSystem);
    return isSameDay(d, new Date(date));
  });
  
  const dayFaults = faultRecords.filter(f => {
    const d = parseTimeWithSystem(f.faultTime, f.timeSystem);
    return isSameDay(d, new Date(date));
  });
  
  const pendingAnomalies = anomalies.filter(a => a.status === 'PENDING').length;
  
  return {
    date,
    totalBudget,
    actualConsumption: Math.round(actualConsumption * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    status,
    payloadCount: dayPayloads.length,
    faultCount: dayFaults.length,
    anomalyCount: pendingAnomalies
  };
}

export function calculateDateRangeBudgets(
  startDate: string,
  endDate: string,
  payloadPlans: PayloadPlan[],
  faultRecords: FaultRecord[],
  orbitElements: OrbitElement[],
  anomalies: { status: string }[]
): DailyBudget[] {
  const budgets: DailyBudget[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let current = new Date(start);
  while (current <= end) {
    const dateStr = getDateOnly(current);
    budgets.push(calculateDailyBudget(
      dateStr,
      payloadPlans,
      faultRecords,
      orbitElements,
      anomalies
    ));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return budgets;
}

export function getWeekDates(baseDate: string): { start: string; end: string; dates: string[] } {
  const base = new Date(baseDate);
  const dayOfWeek = base.getUTCDay();
  
  const start = new Date(base);
  start.setUTCDate(base.getUTCDate() - dayOfWeek);
  
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  
  const dates: string[] = [];
  let current = new Date(start);
  while (current <= end) {
    dates.push(getDateOnly(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return {
    start: getDateOnly(start),
    end: getDateOnly(end),
    dates
  };
}
