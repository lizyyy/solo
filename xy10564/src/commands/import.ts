import * as path from 'path';
import * as fs from 'fs';
import { StorageService } from '../utils/storage';
import {
  Employee,
  SalaryDetail,
  EmploymentRecord,
  CityRule,
  HistoricalDeclaration,
} from '../types';

interface ImportOptions {
  dataDir: string;
  type: 'employee' | 'salary' | 'employment' | 'city-rule' | 'historical';
  file: string;
  operator: string;
}

export async function executeImport(options: ImportOptions): Promise<void> {
  const dataDir = path.resolve(options.dataDir);
  const storage = new StorageService(dataDir);

  if (!storage.exists()) {
    console.log(`❌ 项目不存在: ${dataDir}`);
    console.log('请先运行 ssc init 初始化项目。');
    return;
  }

  const filePath = path.resolve(options.file);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    return;
  }

  try {
    console.log(`\n📥 正在导入 ${options.type} 数据...`);
    console.log(`   源文件: ${filePath}`);

    let importedCount = 0;

    switch (options.type) {
      case 'employee':
        importedCount = await importEmployees(storage, filePath);
        break;
      case 'salary':
        importedCount = await importSalaries(storage, filePath);
        break;
      case 'employment':
        importedCount = await importEmploymentRecords(storage, filePath);
        break;
      case 'city-rule':
        importedCount = await importCityRules(storage, filePath);
        break;
      case 'historical':
        importedCount = await importHistoricalDeclarations(storage, filePath);
        break;
    }

    storage.addOperationLog({
      command: 'import',
      operator: options.operator,
      parameters: {
        type: options.type,
        file: filePath,
      },
      status: 'success',
      message: `成功导入 ${importedCount} 条 ${options.type} 数据`,
    });

    console.log(`\n✅ 导入成功！共导入 ${importedCount} 条数据`);
  } catch (error: any) {
    storage.addOperationLog({
      command: 'import',
      operator: options.operator,
      parameters: {
        type: options.type,
        file: filePath,
      },
      status: 'failed',
      message: error?.message || '导入失败',
    });

    console.log(`\n❌ 导入失败: ${error?.message}`);
  }
}

async function importEmployees(
  storage: StorageService,
  filePath: string
): Promise<number> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const employees = JSON.parse(content) as Array<
    Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>
  >;

  const existingEmployees = storage.getEmployees();
  const existingNos = new Set(existingEmployees.map((e) => e.employeeNo));

  let count = 0;
  for (const emp of employees) {
    if (existingNos.has(emp.employeeNo)) {
      console.log(`   ⚠️  跳过重复员工: ${emp.employeeNo} - ${emp.name}`);
      continue;
    }
    storage.addEmployee(emp);
    count++;
  }

  return count;
}

async function importSalaries(
  storage: StorageService,
  filePath: string
): Promise<number> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const salaries = JSON.parse(content) as Array<
    Omit<SalaryDetail, 'id' | 'createdAt'>
  >;

  const existingSalaries = storage.getSalaries();
  const existingKeys = new Set(
    existingSalaries.map(
      (s) => `${s.employeeId}-${s.year}-${s.month}`
    )
  );

  let count = 0;
  for (const salary of salaries) {
    const key = `${salary.employeeId}-${salary.year}-${salary.month}`;
    if (existingKeys.has(key)) {
      console.log(`   ⚠️  跳过重复工资记录: ${key}`);
      continue;
    }
    storage.addSalary(salary);
    count++;
  }

  return count;
}

async function importEmploymentRecords(
  storage: StorageService,
  filePath: string
): Promise<number> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = JSON.parse(content) as Array<
    Omit<EmploymentRecord, 'id' | 'createdAt'>
  >;

  let count = 0;
  for (const record of records) {
    storage.addEmploymentRecord(record);
    count++;
  }

  return count;
}

async function importCityRules(
  storage: StorageService,
  filePath: string
): Promise<number> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rules = JSON.parse(content) as CityRule[];

  const existingRules = storage.getCityRules();
  const existingKeys = new Set(
    existingRules.map((r) => `${r.city}-${r.year}`)
  );

  let count = 0;
  for (const rule of rules) {
    const key = `${rule.city}-${rule.year}`;
    if (existingKeys.has(key)) {
      console.log(`   ⚠️  跳过重复城市规则: ${key}`);
      continue;
    }
    storage.addCityRule(rule);
    count++;
  }

  return count;
}

async function importHistoricalDeclarations(
  storage: StorageService,
  filePath: string
): Promise<number> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const declarations = JSON.parse(content) as Array<
    Omit<HistoricalDeclaration, 'id' | 'createdAt' | 'updatedAt'>
  >;

  let count = 0;
  for (const declaration of declarations) {
    storage.addHistoricalDeclaration(declaration);
    count++;
  }

  return count;
}
