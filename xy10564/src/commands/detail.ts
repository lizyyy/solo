import * as path from 'path';
import dayjs from 'dayjs';
import Table from 'cli-table3';
import chalk from 'chalk';
import { StorageService } from '../utils/storage';
import { CalculationService } from '../services/calculation-service';

interface DetailOptions {
  dataDir: string;
  employee: string;
  operator: string;
}

export async function executeDetail(options: DetailOptions): Promise<void> {
  const dataDir = path.resolve(options.dataDir);
  const storage = new StorageService(dataDir);

  if (!storage.exists()) {
    console.log(`❌ 项目不存在: ${dataDir}`);
    console.log('请先运行 ssc init 初始化项目。');
    return;
  }

  const config = storage.getConfig();
  const employees = storage.getEmployees();
  const salaries = storage.getSalaries();
  const employmentRecords = storage.getEmploymentRecords();
  const cityRules = storage.getCityRules();
  const historicalDeclarations = storage.getHistoricalDeclarations();
  const corrections = storage.getManualCorrections();

  const employee = employees.find(
    (e) =>
      e.id === options.employee ||
      e.employeeNo === options.employee ||
      e.name === options.employee
  );

  if (!employee) {
    console.log(`❌ 未找到员工: ${options.employee}`);
    storage.addOperationLog({
      command: 'detail',
      operator: options.operator,
      parameters: {
        employee: options.employee,
        dataDir,
      },
      status: 'failed',
      message: `未找到员工: ${options.employee}`,
    });
    return;
  }

  console.log(`\n${chalk.bgBlue.white(' 员工详情 ')}`);
  console.log(`\n👤 基本信息:`);
  console.log(`   工号: ${employee.employeeNo}`);
  console.log(`   姓名: ${employee.name}`);
  console.log(`   部门: ${employee.department}`);
  console.log(`   所在城市: ${employee.city}`);
  console.log(`   试用期: ${employee.isProbation ? '是' : '否'}`);
  console.log(`   试用期工资: ¥${employee.probationSalary.toLocaleString()}`);
  console.log(`   转正工资: ¥${employee.regularSalary.toLocaleString()}`);

  const empEmploymentRecords = employmentRecords
    .filter((r) => r.employeeId === employee.id)
    .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

  console.log(`\n📅 入离职记录:`);
  if (empEmploymentRecords.length > 0) {
    const recordTable = new Table({
      head: ['日期', '类型', '从城市', '到城市', '原因', '操作者'],
      style: { head: ['blue'] },
    });

    empEmploymentRecords.forEach((r) => {
      const typeMap: Record<string, string> = {
        hire: chalk.green('入职'),
        transfer: chalk.yellow('调动'),
        resign: chalk.red('离职'),
      };
      recordTable.push([
        r.date,
        typeMap[r.type] || r.type,
        r.fromCity || '-',
        r.toCity || '-',
        r.reason || '-',
        r.operator,
      ]);
    });

    console.log(recordTable.toString());
  } else {
    console.log(`   暂无记录`);
  }

  const empSalaries = salaries
    .filter(
      (s) => s.employeeId === employee.id && s.year === config.declarationYear
    )
    .sort((a, b) => a.month - b.month);

  console.log(`\n💰 ${config.declarationYear}年工资明细:`);
  if (empSalaries.length > 0) {
    const salaryTable = new Table({
      head: ['月份', '基本工资', '奖金', '津贴', '合计'],
      style: { head: ['green'] },
      colAligns: ['center', 'right', 'right', 'right', 'right'],
    });

    empSalaries.forEach((s) => {
      salaryTable.push([
        `${s.year}-${String(s.month).padStart(2, '0')}`,
        `¥${s.baseSalary.toLocaleString()}`,
        `¥${s.bonus.toLocaleString()}`,
        `¥${s.allowance.toLocaleString()}`,
        chalk.bold(`¥${s.totalSalary.toLocaleString()}`),
      ]);
    });

    const avgSalary =
      empSalaries.reduce((sum, s) => sum + s.totalSalary, 0) /
      empSalaries.length;
    salaryTable.push([
      chalk.blue('平均'),
      '-',
      '-',
      '-',
      chalk.blue.bold(`¥${Math.round(avgSalary).toLocaleString()}`),
    ]);

    console.log(salaryTable.toString());
  } else {
    console.log(`   暂无工资记录`);
  }

  const empCorrections = corrections
    .filter((c) => c.employeeId === employee.id)
    .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());

  if (empCorrections.length > 0) {
    console.log(`\n✏️  人工修正记录:`);
    const corrTable = new Table({
      head: ['时间', '字段', '修改前', '修改后', '原因', '操作者'],
      style: { head: ['yellow'] },
    });

    empCorrections.forEach((c) => {
      corrTable.push([
        dayjs(c.createdAt).format('YYYY-MM-DD HH:mm'),
        c.field,
        String(c.beforeValue),
        String(c.afterValue),
        c.reason,
        c.operator,
      ]);
    });

    console.log(corrTable.toString());
  }

  const empDeclarations = historicalDeclarations
    .filter((d) => d.employeeId === employee.id)
    .sort((a, b) => a.year * 100 + a.declarationMonth - (b.year * 100 + b.declarationMonth));

  if (empDeclarations.length > 0) {
    console.log(`\n📋 历史申报记录:`);
    const declTable = new Table({
      head: ['年度', '申报月', '基数', '生效月', '状态', '操作者'],
      style: { head: ['cyan'] },
      colAligns: ['center', 'center', 'right', 'center', 'center', 'center'],
    });

    const statusMap: Record<string, string> = {
      draft: chalk.gray('草稿'),
      submitted: chalk.blue('已提交'),
      approved: chalk.green('已审批'),
      rejected: chalk.red('已驳回'),
    };

    empDeclarations.forEach((d) => {
      declTable.push([
        d.year,
        d.declarationMonth,
        `¥${d.baseAmount.toLocaleString()}`,
        `${d.startMonth}-${d.endMonth}月`,
        statusMap[d.status] || d.status,
        d.operator,
      ]);
    });

    console.log(declTable.toString());
  }

  const calcService = new CalculationService(
    employees,
    salaries,
    employmentRecords,
    cityRules,
    historicalDeclarations,
    config.declarationYear,
    config.declarationMonth
  );

  const result = calcService.calculateOne(employee);

  console.log(`\n${chalk.bgGreen.white(' 申报计算结果 ')}`);

  const resultTable = new Table({
    head: ['项目', '内容'],
    style: { head: ['green'] },
    colWidths: [20, 60],
  });

  const statusMap: Record<string, string> = {
    ok: chalk.green('正常'),
    warning: chalk.yellow('警告'),
    error: chalk.red('错误'),
  };

  resultTable.push(
    ['状态', statusMap[result.status]],
    ['当前城市', result.currentCity],
    ['原始基数', `¥${result.originalBase.toLocaleString()}`],
    ['建议申报基数', chalk.bold.green(`¥${result.suggestedBase.toLocaleString()}`)],
    ['调整原因', result.adjustmentReason]
  );

  console.log(resultTable.toString());

  if (result.needSupplementary) {
    console.log(`\n${chalk.yellow('⚠️  需要补缴:')}`);
    console.log(`   补缴月份: ${result.supplementaryMonths.join(', ')}`);
    console.log(
      `   补缴差额: ${chalk.red.bold(`¥${result.supplementaryAmount.toLocaleString()}`)}`
    );
  }

  if (result.warnings.length > 0) {
    console.log(`\n${chalk.yellow('⚠️  警告信息:')}`);
    result.warnings.forEach((w, i) => {
      console.log(`   ${i + 1}. ${w}`);
    });
  }

  storage.addOperationLog({
    command: 'detail',
    operator: options.operator,
    parameters: {
      employee: options.employee,
      dataDir,
    },
    status: 'success',
    message: `查看员工 ${employee.name} 详情`,
  });
}
