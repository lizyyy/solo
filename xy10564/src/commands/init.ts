import * as path from 'path';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../utils/storage';
import {
  SAMPLE_EMPLOYEES,
  generateSampleSalaries,
  generateSampleEmploymentRecords,
  SAMPLE_CITY_RULES,
  generateSampleHistoricalDeclarations,
} from '../data/sample-data';
import { ProjectConfig } from '../types';

interface InitOptions {
  dataDir: string;
  name: string;
  year: number;
  month: number;
  withSample: boolean;
  operator: string;
}

export async function executeInit(options: InitOptions): Promise<void> {
  const dataDir = path.resolve(options.dataDir);
  const storage = new StorageService(dataDir);

  if (storage.exists()) {
    console.log(`项目已存在: ${dataDir}`);
    console.log('如果需要重新初始化，请先删除该目录。');
    return;
  }

  const config: ProjectConfig = {
    name: options.name,
    declarationYear: options.year,
    declarationMonth: options.month,
    currentCity: '',
    dataDir: dataDir,
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  };

  storage.init(config);
  console.log(`\n✅ 项目初始化成功: ${options.name}`);
  console.log(`   数据目录: ${dataDir}`);
  console.log(`   申报年度: ${options.year}年${options.month}月`);

  if (options.withSample) {
    console.log('\n📦 正在生成样例数据...');

    const employeeIdMap = new Map<string, string>();

    SAMPLE_EMPLOYEES.forEach((emp) => {
      const newEmployee = storage.addEmployee(emp);
      employeeIdMap.set(emp.employeeNo, newEmployee.id);
    });

    const salaries = generateSampleSalaries(employeeIdMap, options.year);
    salaries.forEach((salary) => {
      storage.addSalary(salary);
    });

    const employmentRecords = generateSampleEmploymentRecords(
      employeeIdMap,
      options.year
    );
    employmentRecords.forEach((record) => {
      storage.addEmploymentRecord(record);
    });

    SAMPLE_CITY_RULES.forEach((rule) => {
      storage.addCityRule(rule);
    });

    const historicalDeclarations = generateSampleHistoricalDeclarations(
      employeeIdMap,
      options.year
    );
    historicalDeclarations.forEach((declaration) => {
      storage.addHistoricalDeclaration(declaration);
    });

    storage.addOperationLog({
      command: 'init',
      operator: options.operator,
      parameters: {
        name: options.name,
        year: options.year,
        month: options.month,
        withSample: true,
      },
      status: 'success',
      message: '初始化项目并生成样例数据',
    });

    console.log('   ✅ 员工数据: 6 人（北京、上海、成都）');
    console.log('   ✅ 工资记录: 完整年度数据');
    console.log('   ✅ 入离职记录: 含入职、离职、跨城市调动');
    console.log('   ✅ 城市规则: 北京、上海、成都2025年上下限');
    console.log('   ✅ 历史申报: 含已提交和已审批记录');

    console.log('\n📋 样例数据场景:');
    console.log('   1. 张三 (北京) - 高薪员工，含年终奖');
    console.log('   2. 李四 (上海) - 7月新入职，试用期员工');
    console.log('   3. 王五 (成都) - 超高薪，超过上限');
    console.log('   4. 赵六 (北京) - 3月已离职，低工资');
    console.log('   5. 钱七 (北京) - 有重复申报历史');
    console.log('   6. 孙八 (上海) - 5月从北京调动到上海，需补缴');
  } else {
    storage.addOperationLog({
      command: 'init',
      operator: options.operator,
      parameters: {
        name: options.name,
        year: options.year,
        month: options.month,
        withSample: false,
      },
      status: 'success',
      message: '初始化空项目',
    });
  }

  console.log('\n💡 下一步:');
  console.log('   ssc check --data-dir ./data  # 检查数据完整性');
  console.log('   ssc report --data-dir ./data # 生成申报报告');
}
