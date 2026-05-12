import * as path from 'path';
import chalk from 'chalk';
import { StorageService } from '../utils/storage';
import { CalculationService } from '../services/calculation-service';
import { CheckResultItem } from '../types';

interface CheckOptions {
  dataDir: string;
  operator: string;
}

export async function executeCheck(options: CheckOptions): Promise<void> {
  const dataDir = path.resolve(options.dataDir);
  const storage = new StorageService(dataDir);

  if (!storage.exists()) {
    console.log(`❌ 项目不存在: ${dataDir}`);
    console.log('请先运行 ssc init 初始化项目。');
    return;
  }

  console.log('\n🔍 开始检查数据完整性...');
  console.log(`   数据目录: ${dataDir}`);

  const config = storage.getConfig();
  console.log(`   申报年度: ${config.declarationYear}年${config.declarationMonth}月`);

  const employees = storage.getEmployees();
  const salaries = storage.getSalaries();
  const employmentRecords = storage.getEmploymentRecords();
  const cityRules = storage.getCityRules();
  const historicalDeclarations = storage.getHistoricalDeclarations();
  const corrections = storage.getManualCorrections();
  const logs = storage.getOperationLogs();

  console.log(`\n📊 数据概览:`);
  console.log(`   员工数: ${employees.length}`);
  console.log(`   工资记录: ${salaries.length} 条`);
  console.log(`   入离职记录: ${employmentRecords.length} 条`);
  console.log(`   城市规则: ${cityRules.length} 条`);
  console.log(`   历史申报: ${historicalDeclarations.length} 条`);
  console.log(`   人工修正: ${corrections.length} 条`);
  console.log(`   操作日志: ${logs.length} 条`);

  const calcService = new CalculationService(
    employees,
    salaries,
    employmentRecords,
    cityRules,
    historicalDeclarations,
    config.declarationYear,
    config.declarationMonth
  );

  const results = calcService.checkDataIntegrity();

  const infoItems = results.filter((r) => r.type === 'info');
  const warningItems = results.filter((r) => r.type === 'warning');
  const errorItems = results.filter((r) => r.type === 'error');

  console.log(`\n📋 检查结果:`);
  console.log(
    `   信息: ${infoItems.length} | 警告: ${warningItems.length} | 错误: ${errorItems.length}`
  );

  if (errorItems.length > 0) {
    console.log(`\n${chalk.red('❌ 错误:')}`);
    errorItems.forEach((item) => {
      console.log(`   ${formatResultItem(item)}`);
    });
  }

  if (warningItems.length > 0) {
    console.log(`\n${chalk.yellow('⚠️  警告:')}`);
    warningItems.forEach((item) => {
      console.log(`   ${formatResultItem(item)}`);
    });
  }

  if (infoItems.length > 0) {
    console.log(`\n${chalk.blue('ℹ️  信息:')}`);
    infoItems.forEach((item) => {
      console.log(`   ${formatResultItem(item)}`);
    });
  }

  storage.addOperationLog({
    command: 'check',
    operator: options.operator,
    parameters: {
      dataDir,
    },
    status: errorItems.length > 0 ? 'failed' : 'success',
    message: `检查完成 - ${infoItems.length}信息/${warningItems.length}警告/${errorItems.length}错误`,
  });

  if (errorItems.length === 0) {
    console.log(`\n✅ 数据检查通过！可以生成申报报告了。`);
    console.log(`💡 下一步: ssc report --data-dir ${dataDir}`);
  } else {
    console.log(`\n❌ 发现 ${errorItems.length} 个错误，请先修复后再生成报告。`);
  }
}

function formatResultItem(item: CheckResultItem): string {
  const prefix = item.employeeName ? `[${item.employeeName}] ` : '';
  return prefix + item.message;
}
