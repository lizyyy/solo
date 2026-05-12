import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import {
  Employee,
  SalaryDetail,
  EmploymentRecord,
  CityRule,
  HistoricalDeclaration,
  CalculationResult,
  CheckResultItem,
} from '../types';

dayjs.extend(isBetween);

export class CalculationService {
  private employees: Employee[];
  private salaries: SalaryDetail[];
  private employmentRecords: EmploymentRecord[];
  private cityRules: CityRule[];
  private historicalDeclarations: HistoricalDeclaration[];
  private declarationYear: number;
  private declarationMonth: number;

  constructor(
    employees: Employee[],
    salaries: SalaryDetail[],
    employmentRecords: EmploymentRecord[],
    cityRules: CityRule[],
    historicalDeclarations: HistoricalDeclaration[],
    declarationYear: number,
    declarationMonth: number
  ) {
    this.employees = employees;
    this.salaries = salaries;
    this.employmentRecords = employmentRecords;
    this.cityRules = cityRules;
    this.historicalDeclarations = historicalDeclarations;
    this.declarationYear = declarationYear;
    this.declarationMonth = declarationMonth;
  }

  calculateAll(): CalculationResult[] {
    return this.employees.map((employee) => this.calculateOne(employee));
  }

  calculateOne(employee: Employee): CalculationResult {
    const warnings: string[] = [];
    const adjustmentReasons: string[] = [];
    let needSupplementary = false;
    const supplementaryMonths: string[] = [];
    let supplementaryAmount = 0;

    const currentCity = this.getCurrentCity(employee.id);
    const cityRule = this.getCityRule(currentCity, this.declarationYear);

    if (!cityRule) {
      warnings.push(`未找到 ${currentCity} ${this.declarationYear} 年的城市社保规则`);
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeNo: employee.employeeNo,
        department: employee.department,
        city: employee.city,
        currentCity,
        suggestedBase: 0,
        originalBase: 0,
        adjustmentReason: '缺少城市规则',
        needSupplementary: false,
        supplementaryMonths: [],
        supplementaryAmount: 0,
        warnings,
        status: 'error',
      };
    }

    const hireRecord = this.getHireRecord(employee.id);
    const resignationRecord = this.getResignationRecord(employee.id);

    const effectiveMonths = this.getEffectiveMonths(
      employee.id,
      hireRecord,
      resignationRecord
    );

    if (effectiveMonths.length === 0) {
      warnings.push('该员工在申报年度内无有效工作月份');
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeNo: employee.employeeNo,
        department: employee.department,
        city: employee.city,
        currentCity,
        suggestedBase: 0,
        originalBase: 0,
        adjustmentReason: '无有效工作月份',
        needSupplementary: false,
        supplementaryMonths: [],
        supplementaryAmount: 0,
        warnings,
        status: 'warning',
      };
    }

    const avgSalary = this.calculateAverageSalary(employee.id, effectiveMonths);

    let originalBase = this.useProbationSalary(employee, effectiveMonths)
      ? employee.probationSalary
      : avgSalary;

    let suggestedBase = originalBase;

    if (suggestedBase < cityRule.minBase) {
      adjustmentReasons.push(`工资低于下限，按下限 ${cityRule.minBase} 调整`);
      suggestedBase = cityRule.minBase;
    } else if (suggestedBase > cityRule.maxBase) {
      adjustmentReasons.push(`工资高于上限，按上限 ${cityRule.maxBase} 调整`);
      suggestedBase = cityRule.maxBase;
    }

    if (resignationRecord) {
      const resignationDate = dayjs(resignationRecord.date);
      const declarationStart = dayjs(`${this.declarationYear}-${String(this.declarationMonth).padStart(2, '0')}-01`);

      if (resignationDate.isBefore(declarationStart, 'month')) {
        warnings.push('员工已离职，不在本次申报范围内');
      } else if (resignationDate.isSame(declarationStart, 'month')) {
        adjustmentReasons.push('离职当月仍需缴纳社保');
      }
    }

    const transferRecord = this.getTransferRecord(employee.id);
    if (transferRecord) {
      adjustmentReasons.push(
        `存在跨城市调动记录（${transferRecord.fromCity} → ${transferRecord.toCity}）`
      );
      const transferDate = dayjs(transferRecord.date);
      const declarationStart = dayjs(`${this.declarationYear}-${String(this.declarationMonth).padStart(2, '0')}-01`);

      if (transferDate.isBefore(declarationStart, 'month')) {
        const monthsBeforeTransfer = effectiveMonths.filter((m) =>
          dayjs(`${m.year}-${String(m.month).padStart(2, '0')}-15`).isBefore(transferDate)
        );

        if (monthsBeforeTransfer.length > 0) {
          const oldCityRule = this.getCityRule(
            transferRecord.fromCity || employee.city,
            this.declarationYear
          );
          if (oldCityRule) {
            const avgBeforeTransfer = this.calculateAverageSalary(
              employee.id,
              monthsBeforeTransfer
            );
            const oldBase = Math.max(
              Math.min(avgBeforeTransfer, oldCityRule.maxBase),
              oldCityRule.minBase
            );

            if (oldBase !== suggestedBase) {
              needSupplementary = true;
              monthsBeforeTransfer.forEach((m) => {
                supplementaryMonths.push(`${m.year}-${String(m.month).padStart(2, '0')}`);
              });
              supplementaryAmount += (suggestedBase - oldBase) * monthsBeforeTransfer.length;
              adjustmentReasons.push('跨城市调动需补缴基数差额');
            }
          }
        }
      }
    }

    const existingDeclarations = this.historicalDeclarations.filter(
      (d) =>
        d.employeeId === employee.id &&
        d.year === this.declarationYear &&
        d.status !== 'rejected'
    );

    if (existingDeclarations.length > 0) {
      const duplicateMonths = new Set<string>();
      existingDeclarations.forEach((decl) => {
        for (let m = decl.startMonth; m <= decl.endMonth; m++) {
          duplicateMonths.add(`${this.declarationYear}-${String(m).padStart(2, '0')}`);
        }
      });

      if (duplicateMonths.size > 0) {
        warnings.push(`存在重复申报月份：${Array.from(duplicateMonths).join(', ')}`);
        const lastDeclaration = existingDeclarations[existingDeclarations.length - 1];
        if (lastDeclaration.baseAmount !== suggestedBase) {
          adjustmentReasons.push('与历史申报基数不一致');
        }
      }
    }

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeNo: employee.employeeNo,
      department: employee.department,
      city: employee.city,
      currentCity,
      suggestedBase: Math.round(suggestedBase * 100) / 100,
      originalBase: Math.round(originalBase * 100) / 100,
      adjustmentReason: adjustmentReasons.length > 0 ? adjustmentReasons.join('；') : '按平均工资申报',
      needSupplementary,
      supplementaryMonths,
      supplementaryAmount: Math.round(supplementaryAmount * 100) / 100,
      warnings,
      status: warnings.length > 0 ? 'warning' : 'ok',
    };
  }

  checkDataIntegrity(): CheckResultItem[] {
    const results: CheckResultItem[] = [];

    results.push({
      type: 'info',
      message: `共 ${this.employees.length} 名员工，${this.salaries.length} 条工资记录`,
    });

    this.employees.forEach((employee) => {
      const employeeSalaries = this.salaries.filter(
        (s) => s.employeeId === employee.id && s.year === this.declarationYear
      );

      if (employeeSalaries.length === 0) {
        results.push({
          type: 'warning',
          employeeId: employee.id,
          employeeName: employee.name,
          message: `${employee.name}（${employee.employeeNo}）${this.declarationYear}年无工资记录`,
        });
      }

      const hireRecord = this.getHireRecord(employee.id);
      if (!hireRecord) {
        results.push({
          type: 'warning',
          employeeId: employee.id,
          employeeName: employee.name,
          message: `${employee.name}（${employee.employeeNo}）缺少入职记录`,
        });
      }

      const cities = new Set<string>();
      cities.add(employee.city);

      const employeeRecords = this.employmentRecords.filter(
        (r) => r.employeeId === employee.id
      );
      employeeRecords.forEach((r) => {
        if (r.fromCity) cities.add(r.fromCity);
        if (r.toCity) cities.add(r.toCity);
      });

      cities.forEach((city) => {
        const rule = this.cityRules.find(
          (r) => r.city === city && r.year === this.declarationYear
        );
        if (!rule) {
          results.push({
            type: 'error',
            employeeId: employee.id,
            employeeName: employee.name,
            message: `缺少 ${city} ${this.declarationYear} 年的社保上下限规则`,
          });
        }
      });

      if (employee.isProbation && employee.probationSalary <= 0) {
        results.push({
          type: 'warning',
          employeeId: employee.id,
          employeeName: employee.name,
          message: `${employee.name}（${employee.employeeNo}）为试用期员工但试用期工资为0`,
        });
      }
    });

    const duplicateSalaries = new Map<string, SalaryDetail[]>();
    this.salaries.forEach((s) => {
      const key = `${s.employeeId}-${s.year}-${s.month}`;
      if (!duplicateSalaries.has(key)) {
        duplicateSalaries.set(key, []);
      }
      duplicateSalaries.get(key)!.push(s);
    });

    duplicateSalaries.forEach((salaries, key) => {
      if (salaries.length > 1) {
        const employee = this.employees.find((e) => e.id === salaries[0].employeeId);
        results.push({
          type: 'error',
          employeeId: salaries[0].employeeId,
          employeeName: employee?.name,
          message: `${employee?.name || '未知员工'} 存在重复工资记录：${key}`,
        });
      }
    });

    const existingDeclarations = this.historicalDeclarations.filter(
      (d) => d.year === this.declarationYear && d.status === 'submitted'
    );
    if (existingDeclarations.length > 0) {
      results.push({
        type: 'info',
        message: `${this.declarationYear}年已有 ${existingDeclarations.length} 条已提交的历史申报记录，请注意幂等性`,
      });
    }

    return results;
  }

  private getCurrentCity(employeeId: string): string {
    const records = this.employmentRecords
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());

    const latestTransfer = records.find((r) => r.type === 'transfer');
    if (latestTransfer?.toCity) {
      return latestTransfer.toCity;
    }

    const employee = this.employees.find((e) => e.id === employeeId);
    return employee?.city || '';
  }

  private getCityRule(city: string, year: number): CityRule | undefined {
    return this.cityRules.find((r) => r.city === city && r.year === year);
  }

  private getHireRecord(employeeId: string): EmploymentRecord | undefined {
    return this.employmentRecords
      .filter((r) => r.employeeId === employeeId && r.type === 'hire')
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())[0];
  }

  private getResignationRecord(employeeId: string): EmploymentRecord | undefined {
    return this.employmentRecords
      .filter((r) => r.employeeId === employeeId && r.type === 'resign')
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())[0];
  }

  private getTransferRecord(employeeId: string): EmploymentRecord | undefined {
    return this.employmentRecords
      .filter((r) => r.employeeId === employeeId && r.type === 'transfer')
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())[0];
  }

  private getEffectiveMonths(
    employeeId: string,
    hireRecord: EmploymentRecord | undefined,
    resignationRecord: EmploymentRecord | undefined
  ): Array<{ year: number; month: number }> {
    const months: Array<{ year: number; month: number }> = [];
    const year = this.declarationYear;

    const hireDate = hireRecord ? dayjs(hireRecord.date) : dayjs(`${year}-01-01`);
    const resignationDate = resignationRecord
      ? dayjs(resignationRecord.date)
      : dayjs(`${year}-12-31`);

    for (let month = 1; month <= 12; month++) {
      const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
      const monthEnd = monthStart.endOf('month');

      if (
        monthEnd.isAfter(hireDate.subtract(1, 'day')) &&
        monthStart.isBefore(resignationDate.add(1, 'day'))
      ) {
        months.push({ year, month });
      }
    }

    return months;
  }

  private useProbationSalary(
    employee: Employee,
    effectiveMonths: Array<{ year: number; month: number }>
  ): boolean {
    if (!employee.isProbation) return false;

    const declarationStart = dayjs(
      `${this.declarationYear}-${String(this.declarationMonth).padStart(2, '0')}-01`
    );

    const effectiveCount = effectiveMonths.filter((m) =>
      dayjs(`${m.year}-${String(m.month).padStart(2, '0')}-15`).isBefore(
        declarationStart
      )
    ).length;

    return effectiveCount < 6;
  }

  private calculateAverageSalary(
    employeeId: string,
    effectiveMonths: Array<{ year: number; month: number }>
  ): number {
    const validSalaries: number[] = [];

    effectiveMonths.forEach(({ year, month }) => {
      const salary = this.salaries.find(
        (s) =>
          s.employeeId === employeeId &&
          s.year === year &&
          s.month === month
      );

      if (salary && salary.totalSalary > 0) {
        validSalaries.push(salary.totalSalary);
      }
    });

    if (validSalaries.length === 0) {
      const employee = this.employees.find((e) => e.id === employeeId);
      return employee?.regularSalary || 0;
    }

    return validSalaries.reduce((sum, s) => sum + s, 0) / validSalaries.length;
  }
}
