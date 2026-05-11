import { db } from '../db';
import { Employee, Shift, Consumption, SubsidyRule } from '../types';

export function importEmployees(employees: Employee[]): {
  inserted: number;
  updated: number;
  errors: { index: number; message: string }[];
} {
  const insertStmt = db.prepare(`
    INSERT INTO employees (employee_id, name, department)
    VALUES (@employeeId, @name, @department)
    ON CONFLICT(employee_id) DO UPDATE SET
      name = excluded.name,
      department = excluded.department
  `);

  const errors: { index: number; message: string }[] = [];
  let inserted = 0;
  let updated = 0;

  const tx = db.transaction((items: Employee[]) => {
    for (let i = 0; i < items.length; i++) {
      const emp = items[i];
      try {
        if (!emp.employeeId || !emp.name || !emp.department) {
          throw new Error('缺少必填字段：employeeId, name, department');
        }

        const existing = db
          .prepare('SELECT employee_id FROM employees WHERE employee_id = ?')
          .get(emp.employeeId);

        const info = insertStmt.run(emp);
        if (info.changes > 0) {
          if (existing) {
            updated++;
          } else {
            inserted++;
          }
        }
      } catch (e: any) {
        errors.push({ index: i, message: e.message });
      }
    }
  });

  tx(employees);
  return { inserted, updated, errors };
}

export function importShifts(shifts: Shift[]): {
  inserted: number;
  updated: number;
  errors: { index: number; message: string }[];
} {
  const insertStmt = db.prepare(`
    INSERT INTO shifts (employee_id, date, shift_type, start_time, end_time, is_work_day)
    VALUES (@employeeId, @date, @shiftType, @startTime, @endTime, @isWorkDay)
    ON CONFLICT(employee_id, date) DO UPDATE SET
      shift_type = excluded.shift_type,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_work_day = excluded.is_work_day
  `);

  const errors: { index: number; message: string }[] = [];
  let inserted = 0;
  let updated = 0;

  const tx = db.transaction((items: Shift[]) => {
    for (let i = 0; i < items.length; i++) {
      const shift = items[i];
      try {
        if (
          !shift.employeeId ||
          !shift.date ||
          !shift.shiftType ||
          !shift.startTime ||
          !shift.endTime
        ) {
          throw new Error('缺少必填字段：employeeId, date, shiftType, startTime, endTime');
        }

        if (shift.shiftType !== 'day' && shift.shiftType !== 'night') {
          throw new Error('shiftType 只能是 day 或 night');
        }

        const existing = db
          .prepare('SELECT id FROM shifts WHERE employee_id = ? AND date = ?')
          .get(shift.employeeId, shift.date);

        const info = insertStmt.run({
          ...shift,
          isWorkDay: shift.isWorkDay ? 1 : 0,
        });

        if (info.changes > 0) {
          if (existing) {
            updated++;
          } else {
            inserted++;
          }
        }
      } catch (e: any) {
        errors.push({ index: i, message: e.message });
      }
    }
  });

  tx(shifts);
  return { inserted, updated, errors };
}

export function importConsumptions(consumptions: Consumption[]): {
  inserted: number;
  skipped: number;
  errors: { index: number; message: string }[];
} {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO consumptions (transaction_id, employee_id, swipe_time, amount, merchant)
    VALUES (@transactionId, @employeeId, @swipeTime, @amount, @merchant)
  `);

  const checkStmt = db.prepare(
    'SELECT transaction_id FROM consumptions WHERE transaction_id = ?'
  );

  const errors: { index: number; message: string }[] = [];
  let inserted = 0;
  let skipped = 0;

  const tx = db.transaction((items: Consumption[]) => {
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      try {
        if (!c.transactionId || !c.employeeId || !c.swipeTime || c.amount === undefined) {
          throw new Error('缺少必填字段：transactionId, employeeId, swipeTime, amount');
        }

        if (typeof c.amount !== 'number' || c.amount < 0) {
          throw new Error('amount 必须是非负数');
        }

        const existing = checkStmt.get(c.transactionId);
        if (existing) {
          skipped++;
          continue;
        }

        const info = insertStmt.run(c);
        if (info.changes > 0) {
          inserted++;
        }
      } catch (e: any) {
        errors.push({ index: i, message: e.message });
      }
    }
  });

  tx(consumptions);
  return { inserted, skipped, errors };
}

export function importSubsidyRule(rule: SubsidyRule): { ruleId: string; isNew: boolean } {
  const existing = db
    .prepare('SELECT rule_id FROM subsidy_rules WHERE rule_id = ?')
    .get(rule.ruleId);

  const insertStmt = db.prepare(`
    INSERT INTO subsidy_rules (
      rule_id, name, day_shift_amount, night_shift_amount, daily_limit,
      meal_times_json, non_work_day_allowed, effective_from, effective_to
    ) VALUES (
      @ruleId, @name, @dayShiftAmount, @nightShiftAmount, @dailyLimit,
      @mealTimesJson, @nonWorkDayAllowed, @effectiveFrom, @effectiveTo
    )
    ON CONFLICT(rule_id) DO UPDATE SET
      name = excluded.name,
      day_shift_amount = excluded.day_shift_amount,
      night_shift_amount = excluded.night_shift_amount,
      daily_limit = excluded.daily_limit,
      meal_times_json = excluded.meal_times_json,
      non_work_day_allowed = excluded.non_work_day_allowed,
      effective_from = excluded.effective_from,
      effective_to = excluded.effective_to
  `);

  insertStmt.run({
    ruleId: rule.ruleId,
    name: rule.name,
    dayShiftAmount: rule.dayShiftAmount,
    nightShiftAmount: rule.nightShiftAmount,
    dailyLimit: rule.dailyLimit,
    mealTimesJson: JSON.stringify(rule.mealTimes),
    nonWorkDayAllowed: rule.nonWorkDayAllowed ? 1 : 0,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo || null,
  });

  return {
    ruleId: rule.ruleId,
    isNew: !existing,
  };
}

export function getSubsidyRule(ruleId: string): SubsidyRule | null {
  const row = db
    .prepare('SELECT * FROM subsidy_rules WHERE rule_id = ?')
    .get(ruleId) as any;

  if (!row) return null;

  return {
    ruleId: row.rule_id,
    name: row.name,
    dayShiftAmount: row.day_shift_amount,
    nightShiftAmount: row.night_shift_amount,
    dailyLimit: row.daily_limit,
    mealTimes: JSON.parse(row.meal_times_json),
    nonWorkDayAllowed: row.non_work_day_allowed === 1,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  };
}

export function getActiveSubsidyRule(date: string): SubsidyRule | null {
  const row = db
    .prepare(`
      SELECT * FROM subsidy_rules
      WHERE effective_from <= ?
      AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC
      LIMIT 1
    `)
    .get(date, date) as any;

  if (!row) return null;

  return {
    ruleId: row.rule_id,
    name: row.name,
    dayShiftAmount: row.day_shift_amount,
    nightShiftAmount: row.night_shift_amount,
    dailyLimit: row.daily_limit,
    mealTimes: JSON.parse(row.meal_times_json),
    nonWorkDayAllowed: row.non_work_day_allowed === 1,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  };
}
