import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../db';
import {
  SubsidyRule,
  AbnormalType,
  AbnormalRecord,
  SubsidyCalculation,
  ApprovalRecord,
  SubsidyStatus,
} from '../types';

interface DayConsumption {
  date: string;
  employeeId: string;
  transactions: {
    transactionId: string;
    swipeTime: string;
    amount: number;
    merchant: string;
  }[];
  shifts: {
    date: string;
    shiftType: 'day' | 'night';
    startTime: string;
    endTime: string;
    isWorkDay: boolean;
    isCrossDay: boolean;
    originalDate: string;
  }[];
}

function isTimeInRange(time: string, start: string, end: string): boolean {
  const t = parseInt(time.replace(':', ''), 10);
  const s = parseInt(start.replace(':', ''), 10);
  const e = parseInt(end.replace(':', ''), 10);

  if (s <= e) {
    return t >= s && t < e;
  }
  return t >= s || t < e;
}

function getMealType(swipeTime: string, rule: SubsidyRule): string | null {
  const time = swipeTime.split(' ')[1]?.substring(0, 5) || swipeTime;

  if (rule.mealTimes.breakfast && isTimeInRange(time, rule.mealTimes.breakfast.start, rule.mealTimes.breakfast.end)) {
    return 'breakfast';
  }
  if (rule.mealTimes.lunch && isTimeInRange(time, rule.mealTimes.lunch.start, rule.mealTimes.lunch.end)) {
    return 'lunch';
  }
  if (rule.mealTimes.dinner && isTimeInRange(time, rule.mealTimes.dinner.start, rule.mealTimes.dinner.end)) {
    return 'dinner';
  }
  if (rule.mealTimes.nightMeal && isTimeInRange(time, rule.mealTimes.nightMeal.start, rule.mealTimes.nightMeal.end)) {
    return 'nightMeal';
  }
  return null;
}

function isShiftCrossDay(startTime: string, endTime: string): boolean {
  const s = parseInt(startTime.replace(':', ''), 10);
  const e = parseInt(endTime.replace(':', ''), 10);
  return e < s;
}

function getSwipeDateKey(swipeTime: string, shiftStartTime?: string, shiftEndTime?: string): string {
  const dt = dayjs(swipeTime);
  const dateStr = dt.format('YYYY-MM-DD');
  const timeStr = dt.format('HH:mm');

  if (shiftStartTime && shiftEndTime && isShiftCrossDay(shiftStartTime, shiftEndTime)) {
    const s = parseInt(shiftStartTime.replace(':', ''), 10);
    const t = parseInt(timeStr.replace(':', ''), 10);
    if (t < s) {
      return dt.subtract(1, 'day').format('YYYY-MM-DD');
    }
  }
  return dateStr;
}

function buildDayConsumptions(periodStart: string, periodEnd: string, rule: SubsidyRule): Map<string, DayConsumption> {
  const dayMap = new Map<string, DayConsumption>();

  const employees = db.prepare('SELECT employee_id FROM employees').all() as any[];

  for (const emp of employees) {
    const empId = emp.employee_id;

    const shifts = db
      .prepare(`
        SELECT * FROM shifts
        WHERE employee_id = ?
        AND date >= ? AND date <= ?
      `)
      .all(empId, periodStart, periodEnd) as any[];

    for (const shift of shifts) {
      const isCrossDay = isShiftCrossDay(shift.start_time, shift.end_time);
      const dates = [shift.date];
      if (isCrossDay) {
        dates.push(dayjs(shift.date).add(1, 'day').format('YYYY-MM-DD'));
      }

      for (const date of dates) {
        const key = `${empId}|${date}`;
        if (!dayMap.has(key)) {
          dayMap.set(key, {
            date,
            employeeId: empId,
            transactions: [],
            shifts: [],
          });
        }
        dayMap.get(key)!.shifts.push({
          date,
          shiftType: shift.shift_type,
          startTime: shift.start_time,
          endTime: shift.end_time,
          isWorkDay: shift.is_work_day === 1,
          isCrossDay,
          originalDate: shift.date,
        });
      }
    }

    const consumptions = db
      .prepare(`
        SELECT * FROM consumptions
        WHERE employee_id = ?
        AND date(swipe_time) >= ? AND date(swipe_time) <= ?
        ORDER BY swipe_time
      `)
      .all(empId, periodStart, periodEnd) as any[];

    for (const c of consumptions) {
      const swipeTime = c.swipe_time;

      let matchedDate: string | null = null;

      for (const shift of shifts) {
        const isCrossDay = isShiftCrossDay(shift.start_time, shift.end_time);
        const dateKey = getSwipeDateKey(swipeTime, shift.start_time, shift.end_time);

        if (dateKey >= periodStart && dateKey <= periodEnd) {
          if (isCrossDay) {
            if (dateKey === shift.date || dateKey === dayjs(shift.date).add(1, 'day').format('YYYY-MM-DD')) {
              matchedDate = dateKey;
              break;
            }
          } else if (dateKey === shift.date) {
            matchedDate = dateKey;
            break;
          }
        }
      }

      if (!matchedDate) {
        matchedDate = dayjs(swipeTime).format('YYYY-MM-DD');
      }

      if (matchedDate >= periodStart && matchedDate <= periodEnd) {
        const key = `${empId}|${matchedDate}`;
        if (!dayMap.has(key)) {
          dayMap.set(key, {
            date: matchedDate,
            employeeId: empId,
            transactions: [],
            shifts: [],
          });
        }
        dayMap.get(key)!.transactions.push({
          transactionId: c.transaction_id,
          swipeTime: c.swipe_time,
          amount: c.amount,
          merchant: c.merchant,
        });
      }
    }
  }

  return dayMap;
}

export interface CalculateResult {
  batchId: string;
  totalDays: number;
  totalAbnormal: number;
  abnormalBreakdown: { type: AbnormalType; count: number }[];
}

export function calculateSubsidies(periodStart: string, periodEnd: string, ruleId: string): CalculateResult {
  const rule = db
    .prepare('SELECT * FROM subsidy_rules WHERE rule_id = ?')
    .get(ruleId) as any;

  if (!rule) {
    throw new Error('补贴规则不存在');
  }

  const subsidyRule: SubsidyRule = {
    ruleId: rule.rule_id,
    name: rule.name,
    dayShiftAmount: rule.day_shift_amount,
    nightShiftAmount: rule.night_shift_amount,
    dailyLimit: rule.daily_limit,
    mealTimes: JSON.parse(rule.meal_times_json),
    nonWorkDayAllowed: rule.non_work_day_allowed === 1,
    effectiveFrom: rule.effective_from,
    effectiveTo: rule.effective_to,
  };

  const batchId = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  db.prepare(`
    INSERT INTO calculation_batches (batch_id, period_start, period_end, rule_id, status, created_at)
    VALUES (?, ?, ?, ?, 'calculating', ?)
  `).run(batchId, periodStart, periodEnd, ruleId, now);

  const dayMap = buildDayConsumptions(periodStart, periodEnd, subsidyRule);
  const abnormalRecords: AbnormalRecord[] = [];
  const calculations: SubsidyCalculation[] = [];
  let totalAbnormal = 0;
  const abnormalCounts = new Map<AbnormalType, number>();

  for (const [, dayData] of dayMap) {
    const dailyAbnormals: AbnormalRecord[] = [];
    const dailyAbnormalIds: string[] = [];

    const hasDayShift = dayData.shifts.some(s => s.shiftType === 'day');
    const hasNightShift = dayData.shifts.some(s => s.shiftType === 'night');
    const isWorkDay = dayData.shifts.length > 0 ? dayData.shifts.some(s => s.isWorkDay) : false;
    const isNonWorkDayWithShift = dayData.shifts.length > 0 && !isWorkDay;

    let shiftAmbiguous = false;
    if (dayData.transactions.length > 0 && dayData.shifts.length === 0) {
      shiftAmbiguous = true;
      const abnormal: AbnormalRecord = {
        abnormalId: uuidv4(),
        employeeId: dayData.employeeId,
        type: 'shift_ambiguous',
        description: `消费日期 ${dayData.date} 无匹配班次，无法确定餐补归属`,
        detectedAt: now,
      };
      dailyAbnormals.push(abnormal);
      dailyAbnormalIds.push(abnormal.abnormalId);
      abnormalCounts.set('shift_ambiguous', (abnormalCounts.get('shift_ambiguous') || 0) + 1);
      totalAbnormal++;
    }

    if (dayData.shifts.length > 1) {
      const shiftDates = new Set(dayData.shifts.map(s => s.originalDate));
      if (shiftDates.size > 1) {
        shiftAmbiguous = true;
        const abnormal: AbnormalRecord = {
          abnormalId: uuidv4(),
          employeeId: dayData.employeeId,
          type: 'shift_ambiguous',
          description: `跨天班次重叠，无法确定 ${dayData.date} 消费归属的班次`,
          detectedAt: now,
        };
        dailyAbnormals.push(abnormal);
        dailyAbnormalIds.push(abnormal.abnormalId);
        abnormalCounts.set('shift_ambiguous', (abnormalCounts.get('shift_ambiguous') || 0) + 1);
        totalAbnormal++;
      }
    }

    if (isNonWorkDayWithShift && !subsidyRule.nonWorkDayAllowed && dayData.transactions.length > 0) {
      for (const tx of dayData.transactions) {
        const abnormal: AbnormalRecord = {
          abnormalId: uuidv4(),
          employeeId: dayData.employeeId,
          transactionId: tx.transactionId,
          type: 'non_workday',
          description: `非工作日消费，交易号: ${tx.transactionId}，时间: ${tx.swipeTime}`,
          detectedAt: now,
        };
        dailyAbnormals.push(abnormal);
        dailyAbnormalIds.push(abnormal.abnormalId);
        abnormalCounts.set('non_workday', (abnormalCounts.get('non_workday') || 0) + 1);
        totalAbnormal++;
      }
    }

    const mealTypeCount = new Map<string, number>();
    const mealTransactions = new Map<string, any[]>();

    for (const tx of dayData.transactions) {
      const mealType = getMealType(tx.swipeTime, subsidyRule);
      if (mealType) {
        mealTypeCount.set(mealType, (mealTypeCount.get(mealType) || 0) + 1);
        const list = mealTransactions.get(mealType) || [];
        list.push(tx);
        mealTransactions.set(mealType, list);
      }
    }

    for (const [mealType, count] of mealTypeCount) {
      if (count > 1) {
        const txs = mealTransactions.get(mealType)!;
        txs.sort((a, b) => a.amount - b.amount);
        for (let i = 1; i < txs.length; i++) {
          const abnormal: AbnormalRecord = {
            abnormalId: uuidv4(),
            employeeId: dayData.employeeId,
            transactionId: txs[i].transactionId,
            type: 'duplicate_swipe',
            description: `同一餐段重复刷卡，餐段: ${mealType}，交易号: ${txs[i].transactionId}`,
            detectedAt: now,
          };
          dailyAbnormals.push(abnormal);
          dailyAbnormalIds.push(abnormal.abnormalId);
          abnormalCounts.set('duplicate_swipe', (abnormalCounts.get('duplicate_swipe') || 0) + 1);
          totalAbnormal++;
        }
      }
    }

    let baseAmount = 0;
    const isNightShift = hasNightShift && !hasDayShift;
    if (isNightShift) {
      baseAmount = subsidyRule.nightShiftAmount;
    } else if (hasDayShift) {
      baseAmount = subsidyRule.dayShiftAmount;
    }

    let qualifiedTransactions = dayData.transactions.filter((tx, index, arr) => {
      const mealType = getMealType(tx.swipeTime, subsidyRule);
      if (!mealType) return false;

      const sameMealTxs = arr
        .filter(t => getMealType(t.swipeTime, subsidyRule) === mealType)
        .sort((a, b) => a.amount - b.amount);
      return sameMealTxs[0].transactionId === tx.transactionId;
    });

    if (isNonWorkDayWithShift && !subsidyRule.nonWorkDayAllowed) {
      qualifiedTransactions = [];
    }

    let totalAmount = 0;
    if (qualifiedTransactions.length > 0) {
      totalAmount = Math.min(
        qualifiedTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        baseAmount
      );
    }

    if (totalAmount > subsidyRule.dailyLimit) {
      const abnormal: AbnormalRecord = {
        abnormalId: uuidv4(),
        employeeId: dayData.employeeId,
        type: 'exceed_limit',
        description: `日消费总额 ${totalAmount.toFixed(2)} 超出日限额 ${subsidyRule.dailyLimit.toFixed(2)}`,
        detectedAt: now,
      };
      dailyAbnormals.push(abnormal);
      dailyAbnormalIds.push(abnormal.abnormalId);
      abnormalCounts.set('exceed_limit', (abnormalCounts.get('exceed_limit') || 0) + 1);
      totalAbnormal++;
      totalAmount = subsidyRule.dailyLimit;
    }

    const hasSeriousAbnormal = dailyAbnormals.some(
      a => a.type === 'shift_ambiguous' || a.type === 'non_workday'
    );

    let status: SubsidyStatus = 'normal';
    if (hasSeriousAbnormal) {
      status = 'suspended';
    } else if (dailyAbnormals.length > 0) {
      status = 'adjusted';
    }

    if (dayData.transactions.length > 0 || dayData.shifts.length > 0) {
      calculations.push({
        calculationId: uuidv4(),
        employeeId: dayData.employeeId,
        date: dayData.date,
        originalAmount: totalAmount,
        adjustedAmount: status === 'suspended' ? 0 : totalAmount,
        status,
        abnormalIds: dailyAbnormalIds,
        approvalStatus: dailyAbnormalIds.length > 0 ? 'pending' : 'approved',
        calculatedAt: now,
      });
    }

    abnormalRecords.push(...dailyAbnormals);
  }

  const tx = db.transaction(() => {
    const insertAbnormal = db.prepare(`
      INSERT INTO abnormal_records (abnormal_id, employee_id, transaction_id, type, description, detected_at, batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of abnormalRecords) {
      insertAbnormal.run(
        a.abnormalId,
        a.employeeId,
        a.transactionId || null,
        a.type,
        a.description,
        a.detectedAt,
        batchId
      );
    }

    const insertCalc = db.prepare(`
      INSERT INTO subsidy_calculations (
        calculation_id, employee_id, date, original_amount, adjusted_amount,
        status, abnormal_ids_json, approval_status, batch_id, calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of calculations) {
      insertCalc.run(
        c.calculationId,
        c.employeeId,
        c.date,
        c.originalAmount,
        c.adjustedAmount,
        c.status,
        JSON.stringify(c.abnormalIds),
        c.approvalStatus,
        batchId,
        c.calculatedAt
      );
    }

    const completedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare(`
      UPDATE calculation_batches SET status = 'completed', completed_at = ?
      WHERE batch_id = ?
    `).run(completedAt, batchId);
  });

  tx();

  const abnormalBreakdown: { type: AbnormalType; count: number }[] = [];
  for (const [type, count] of abnormalCounts) {
    abnormalBreakdown.push({ type: type as AbnormalType, count });
  }

  return {
    batchId,
    totalDays: calculations.length,
    totalAbnormal,
    abnormalBreakdown,
  };
}

export interface ApprovalInput {
  calculationId: string;
  operator: string;
  action: 'approve' | 'reject' | 'adjust';
  newAmount?: number;
  reason: string;
}

export function processApproval(input: ApprovalInput): {
  success: boolean;
  calculationId: string;
  previousAmount: number;
  newAmount: number;
  difference: number;
} {
  const calc = db
    .prepare('SELECT * FROM subsidy_calculations WHERE calculation_id = ?')
    .get(input.calculationId) as any;

  if (!calc) {
    throw new Error('计算记录不存在');
  }

  const previousAmount = calc.adjusted_amount;
  let newAmount = previousAmount;
  let newApprovalStatus: string = calc.approval_status;
  let newStatus: string = calc.status;

  if (input.action === 'approve') {
    newApprovalStatus = 'approved';
    newStatus = calc.original_amount > 0 ? 'normal' : 'normal';
  } else if (input.action === 'reject') {
    newApprovalStatus = 'rejected';
    newStatus = 'suspended';
    newAmount = 0;
  } else if (input.action === 'adjust') {
    if (input.newAmount === undefined) {
      throw new Error('调整操作必须提供 newAmount');
    }
    newAmount = input.newAmount;
    newApprovalStatus = 'approved';
    newStatus = 'adjusted';
  }

  const approvalId = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE subsidy_calculations
      SET adjusted_amount = ?, approval_status = ?, status = ?
      WHERE calculation_id = ?
    `).run(newAmount, newApprovalStatus, newStatus, input.calculationId);

    db.prepare(`
      INSERT INTO approval_records (
        approval_id, calculation_id, employee_id, operator, action, new_amount, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      approvalId,
      input.calculationId,
      calc.employee_id,
      input.operator,
      input.action,
      input.action === 'adjust' ? input.newAmount : null,
      input.reason,
      now
    );
  });

  tx();

  return {
    success: true,
    calculationId: input.calculationId,
    previousAmount,
    newAmount,
    difference: newAmount - previousAmount,
  };
}

export function regenerateReport(batchId: string): {
  batchId: string;
  totalEmployees: number;
  totalAmount: number;
} {
  const batch = db
    .prepare('SELECT * FROM calculation_batches WHERE batch_id = ?')
    .get(batchId) as any;

  if (!batch) {
    throw new Error('批次不存在');
  }

  db.prepare(`
    UPDATE calculation_batches SET status = 'regenerating'
    WHERE batch_id = ?
  `).run(batchId);

  const result = db
    .prepare(`
      SELECT
        COUNT(DISTINCT employee_id) as employee_count,
        SUM(CASE WHEN approval_status = 'approved' THEN adjusted_amount ELSE 0 END) as total_amount
      FROM subsidy_calculations
      WHERE batch_id = ?
    `)
    .get(batchId) as any;

  db.prepare(`
    UPDATE calculation_batches SET status = 'completed'
    WHERE batch_id = ?
  `).run(batchId);

  return {
    batchId,
    totalEmployees: result.employee_count || 0,
    totalAmount: result.total_amount || 0,
  };
}
