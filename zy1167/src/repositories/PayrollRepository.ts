import { db } from '../database';
import { Payroll, PayrollId, EmployeeId } from '../types';
import { generateUUID } from '../utils/idempotency';
import { logger } from '../utils/logger';

export class PayrollRepository {
  private static instance: PayrollRepository | null = null;

  private constructor() {}

  public static getInstance(): PayrollRepository {
    if (!PayrollRepository.instance) {
      PayrollRepository.instance = new PayrollRepository();
    }
    return PayrollRepository.instance;
  }

  public async create(payrollData: Omit<Payroll, 'id' | 'netSalary' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Payroll> {
    const id = generateUUID();
    const now = new Date();
    
    const netSalary = this.calculateNetSalary(payrollData);

    await db.run(
      `
      INSERT INTO payrolls (
        id, employee_id, year, month, base_salary, bonus, allowance,
        deduction, tax, social_insurance, housing_fund, net_salary,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        payrollData.employeeId,
        payrollData.year,
        payrollData.month,
        payrollData.baseSalary,
        payrollData.bonus,
        payrollData.allowance,
        payrollData.deduction,
        payrollData.tax,
        payrollData.socialInsurance,
        payrollData.housingFund,
        netSalary,
        'pending',
        now.toISOString(),
        now.toISOString()
      ]
    );

    return this.findById(id) as Promise<Payroll>;
  }

  public async findById(id: PayrollId): Promise<Payroll | undefined> {
    const row = await db.get(
      'SELECT * FROM payrolls WHERE id = ?',
      [id]
    );
    return row ? this.mapRowToPayroll(row) : undefined;
  }

  public async findByEmployeeAndMonth(employeeId: EmployeeId, year: number, month: number): Promise<Payroll | undefined> {
    const row = await db.get(
      'SELECT * FROM payrolls WHERE employee_id = ? AND year = ? AND month = ?',
      [employeeId, year, month]
    );
    return row ? this.mapRowToPayroll(row) : undefined;
  }

  public async findByMonth(year: number, month: number): Promise<Payroll[]> {
    const rows = await db.all(
      'SELECT * FROM payrolls WHERE year = ? AND month = ? ORDER BY created_at DESC',
      [year, month]
    );
    return rows.map(row => this.mapRowToPayroll(row));
  }

  public async findByEmployeeId(employeeId: EmployeeId): Promise<Payroll[]> {
    const rows = await db.all(
      'SELECT * FROM payrolls WHERE employee_id = ? ORDER BY year DESC, month DESC',
      [employeeId]
    );
    return rows.map(row => this.mapRowToPayroll(row));
  }

  public async findAll(page: number = 1, pageSize: number = 100): Promise<{ payrolls: Payroll[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const [countResult, rows] = await Promise.all([
      db.get<{ count: number }>('SELECT COUNT(*) as count FROM payrolls'),
      db.all(
        'SELECT * FROM payrolls ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [pageSize, offset]
      )
    ]);

    return {
      payrolls: rows.map(row => this.mapRowToPayroll(row)),
      total: countResult?.count || 0
    };
  }

  public async update(id: PayrollId, updates: Partial<Omit<Payroll, 'id' | 'employeeId' | 'year' | 'month' | 'createdAt'>>): Promise<Payroll | undefined> {
    const now = new Date();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now.toISOString()];

    const currentPayroll = await this.findById(id);
    if (!currentPayroll) {
      return undefined;
    }

    let needsNetSalaryRecalc = false;

    if (updates.baseSalary !== undefined) {
      fields.push('base_salary = ?');
      values.push(updates.baseSalary);
      needsNetSalaryRecalc = true;
    }
    if (updates.bonus !== undefined) {
      fields.push('bonus = ?');
      values.push(updates.bonus);
      needsNetSalaryRecalc = true;
    }
    if (updates.allowance !== undefined) {
      fields.push('allowance = ?');
      values.push(updates.allowance);
      needsNetSalaryRecalc = true;
    }
    if (updates.deduction !== undefined) {
      fields.push('deduction = ?');
      values.push(updates.deduction);
      needsNetSalaryRecalc = true;
    }
    if (updates.tax !== undefined) {
      fields.push('tax = ?');
      values.push(updates.tax);
      needsNetSalaryRecalc = true;
    }
    if (updates.socialInsurance !== undefined) {
      fields.push('social_insurance = ?');
      values.push(updates.socialInsurance);
      needsNetSalaryRecalc = true;
    }
    if (updates.housingFund !== undefined) {
      fields.push('housing_fund = ?');
      values.push(updates.housingFund);
      needsNetSalaryRecalc = true;
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (needsNetSalaryRecalc) {
      const updatedData = {
        baseSalary: updates.baseSalary ?? currentPayroll.baseSalary,
        bonus: updates.bonus ?? currentPayroll.bonus,
        allowance: updates.allowance ?? currentPayroll.allowance,
        deduction: updates.deduction ?? currentPayroll.deduction,
        tax: updates.tax ?? currentPayroll.tax,
        socialInsurance: updates.socialInsurance ?? currentPayroll.socialInsurance,
        housingFund: updates.housingFund ?? currentPayroll.housingFund,
        employeeId: currentPayroll.employeeId,
        year: currentPayroll.year,
        month: currentPayroll.month
      };
      const newNetSalary = this.calculateNetSalary(updatedData);
      fields.push('net_salary = ?');
      values.push(newNetSalary);
    }

    values.push(id);

    await db.run(
      `UPDATE payrolls SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  public async confirm(id: PayrollId): Promise<Payroll | undefined> {
    return this.update(id, { status: 'confirmed' });
  }

  public async delete(id: PayrollId): Promise<boolean> {
    const result = await db.run(
      'DELETE FROM payrolls WHERE id = ?',
      [id]
    );
    return result.changes > 0;
  }

  public async bulkCreate(payrollsData: Omit<Payroll, 'id' | 'netSalary' | 'status' | 'createdAt' | 'updatedAt'>[]): Promise<Payroll[]> {
    const createdPayrolls: Payroll[] = [];

    await db.transaction(async () => {
      for (const payrollData of payrollsData) {
        const existing = await this.findByEmployeeAndMonth(
          payrollData.employeeId,
          payrollData.year,
          payrollData.month
        );
        
        if (existing) {
          logger.warn('Payroll already exists for employee and month, skipping', {
            employeeId: payrollData.employeeId,
            year: payrollData.year,
            month: payrollData.month
          });
          continue;
        }
        
        const payroll = await this.create(payrollData);
        createdPayrolls.push(payroll);
      }
    });

    return createdPayrolls;
  }

  public async countByMonth(year: number, month: number): Promise<number> {
    const result = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM payrolls WHERE year = ? AND month = ?',
      [year, month]
    );
    return result?.count || 0;
  }

  public async sumNetSalaryByMonth(year: number, month: number): Promise<number> {
    const result = await db.get<{ total: number }>(
      'SELECT SUM(net_salary) as total FROM payrolls WHERE year = ? AND month = ?',
      [year, month]
    );
    return result?.total || 0;
  }

  public async count(): Promise<number> {
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM payrolls');
    return result?.count || 0;
  }

  private calculateNetSalary(payrollData: {
    baseSalary: number;
    bonus: number;
    allowance: number;
    deduction: number;
    tax: number;
    socialInsurance: number;
    housingFund: number;
  }): number {
    const totalIncome = payrollData.baseSalary + payrollData.bonus + payrollData.allowance;
    const totalDeductions = payrollData.deduction + payrollData.tax + payrollData.socialInsurance + payrollData.housingFund;
    return Math.max(0, totalIncome - totalDeductions);
  }

  private mapRowToPayroll(row: any): Payroll {
    return {
      id: row.id,
      employeeId: row.employee_id,
      year: row.year,
      month: row.month,
      baseSalary: row.base_salary,
      bonus: row.bonus,
      allowance: row.allowance,
      deduction: row.deduction,
      tax: row.tax,
      socialInsurance: row.social_insurance,
      housingFund: row.housing_fund,
      netSalary: row.net_salary,
      status: row.status as 'pending' | 'confirmed',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export const payrollRepository = PayrollRepository.getInstance();
