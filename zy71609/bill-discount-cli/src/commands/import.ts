import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import chalk from 'chalk';
import {
  Bill,
  Quote,
  Application,
  CalendarEntry,
  Payment,
  DataType,
  ImportStrategy,
} from '../types';
import { importWithStrategy } from '../store/importStrategy';
import { loadStore } from '../store/store';

const DATA_TYPE_MAP: Record<string, DataType> = {
  bills: 'bills',
  quotes: 'quotes',
  applications: 'applications',
  calendar: 'calendar',
  payments: 'payments',
};

const DATA_TYPE_LABELS: Record<DataType, string> = {
  bills: '票据清单',
  quotes: '银行报价',
  applications: '贴现申请',
  calendar: '到期日历',
  payments: '付款流水',
};

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

function mapToBills(rows: Record<string, string>[]): Bill[] {
  return rows.map((row) => ({
    billNo: row['票据号'] || row['billNo'] || '',
    drawer: row['出票人'] || row['drawer'] || '',
    payee: row['收款人'] || row['payee'] || '',
    acceptor: row['承兑人'] || row['acceptor'] || '',
    amount: parseFloat(row['票面金额'] || row['amount'] || '0'),
    issueDate: row['出票日'] || row['issueDate'] || '',
    maturityDate: row['到期日'] || row['maturityDate'] || '',
    billType: (row['票据类型'] || row['billType'] || '电子') as Bill['billType'],
    status: (row['状态'] || row['status'] || 'pending') as Bill['status'],
    notes: row['备注'] || row['notes'] || '',
    createdAt: '',
    updatedAt: '',
  }));
}

function mapToQuotes(rows: Record<string, string>[]): Quote[] {
  return rows.map((row) => ({
    id: row['报价ID'] || row['id'] || `Q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    bankName: row['银行名称'] || row['bankName'] || '',
    billType: (row['票据类型'] || row['billType'] || '电子') as Quote['billType'],
    rate: parseFloat(row['贴现利率'] || row['rate'] || '0'),
    effectiveDate: row['生效日'] || row['effectiveDate'] || '',
    expiryDate: row['到期日'] || row['expiryDate'] || '',
    version: parseInt(row['版本'] || row['version'] || '1', 10),
    minAmount: parseFloat(row['最低金额'] || row['minAmount'] || '0'),
    maxAmount: parseFloat(row['最高金额'] || row['maxAmount'] || '999999999'),
    createdAt: '',
  }));
}

function mapToApplications(rows: Record<string, string>[]): Application[] {
  return rows.map((row) => ({
    appId: row['申请编号'] || row['appId'] || '',
    billNo: row['票据号'] || row['billNo'] || '',
    bankName: row['银行名称'] || row['bankName'] || '',
    discountDate: row['贴现日'] || row['discountDate'] || '',
    appliedRate: parseFloat(row['申请利率'] || row['appliedRate'] || '0'),
    status: (row['状态'] || row['status'] || 'pending') as Application['status'],
    notes: row['备注'] || row['notes'] || '',
    createdAt: '',
    updatedAt: '',
  }));
}

function mapToCalendar(rows: Record<string, string>[]): CalendarEntry[] {
  return rows.map((row) => ({
    date: row['日期'] || row['date'] || '',
    isWorkday: (row['是否工作日'] || row['isWorkday'] || '1') === '1' || (row['是否工作日'] || row['isWorkday'] || 'true') === 'true',
    holidayName: row['假日名称'] || row['holidayName'] || '',
  }));
}

function mapToPayments(rows: Record<string, string>[]): Payment[] {
  return rows.map((row) => ({
    paymentId: row['流水号'] || row['paymentId'] || '',
    billNo: row['票据号'] || row['billNo'] || '',
    amount: parseFloat(row['金额'] || row['amount'] || '0'),
    paymentDate: row['付款日'] || row['paymentDate'] || '',
    payer: row['付款人'] || row['payer'] || '',
    payee: row['收款人'] || row['payee'] || '',
    status: (row['状态'] || row['status'] || 'pending') as Payment['status'],
    createdAt: '',
  }));
}

function printImportResult(result: import('../types').ImportResult): void {
  console.log(chalk.bold(`\n导入结果 [${DATA_TYPE_LABELS[result.dataType as DataType] || result.dataType}]:`));
  console.log(`  总计:   ${result.total}`);
  console.log(`  ${chalk.green('新增')}:   ${result.inserted}`);
  console.log(`  ${chalk.yellow('跳过')}:   ${result.skipped}`);
  console.log(`  ${chalk.blue('更新')}:   ${result.updated}`);

  if (result.conflicts.length > 0) {
    console.log(chalk.red(`  冲突:   ${result.conflicts.length}`));
    for (const c of result.conflicts) {
      console.log(chalk.red(`    → [${c.key}] ${c.fieldName}: "${c.existingValue}" → "${c.newValue}"`));
    }
  }
  console.log(`  时间:   ${result.timestamp}`);
}

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('导入数据 (票据/报价/申请/日历/流水)')
    .requiredOption('-t, --type <type>', '数据类型: bills|quotes|applications|calendar|payments')
    .requiredOption('-f, --file <path>', 'CSV 文件路径')
    .option('-s, --strategy <strategy>', '重复策略: skip|update|conflict', 'update')
    .action((opts) => {
      const dataType = DATA_TYPE_MAP[opts.type];
      if (!dataType) {
        console.error(chalk.red(`未知数据类型: ${opts.type}`));
        console.error(`可选: ${Object.keys(DATA_TYPE_MAP).join(', ')}`);
        process.exit(1);
      }

      const filePath = path.resolve(opts.file);
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`文件不存在: ${filePath}`));
        process.exit(1);
      }

      const strategy = opts.strategy as ImportStrategy;
      if (!['skip', 'update', 'conflict'].includes(strategy)) {
        console.error(chalk.red(`未知策略: ${strategy}`));
        console.error('可选: skip, update, conflict');
        process.exit(1);
      }

      const rows = parseCsv(filePath);
      if (rows.length === 0) {
        console.error(chalk.red('CSV 文件为空或格式错误'));
        process.exit(1);
      }

      let records: any[];
      switch (dataType) {
        case 'bills':
          records = mapToBills(rows);
          break;
        case 'quotes':
          records = mapToQuotes(rows);
          break;
        case 'applications':
          records = mapToApplications(rows);
          break;
        case 'calendar':
          records = mapToCalendar(rows);
          break;
        case 'payments':
          records = mapToPayments(rows);
          break;
      }

      const result = importWithStrategy(dataType, records, strategy, (conflict) => {
        console.log(chalk.yellow(`\n冲突: [${conflict.key}] ${conflict.fieldName}`));
        console.log(`  现有值: ${conflict.existingValue}`);
        console.log(`  新  值: ${conflict.newValue}`);
        console.log(`  默认保留现有值 (skip)`);
        return 'skip';
      });

      printImportResult(result);

      if (result.conflicts.length > 0) {
        console.log(chalk.yellow('\n提示: 存在未解决冲突，使用 --strategy update 可覆盖，或手动修改数据后重新导入'));
      }
    });
}
