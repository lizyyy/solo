import {
  Employee,
  SalaryDetail,
  EmploymentRecord,
  CityRule,
  HistoricalDeclaration,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const now = dayjs().toISOString();

export const SAMPLE_EMPLOYEES: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    employeeNo: 'EMP001',
    name: '张三',
    department: '技术部',
    city: '北京',
    isProbation: false,
    probationSalary: 15000,
    regularSalary: 25000,
  },
  {
    employeeNo: 'EMP002',
    name: '李四',
    department: '产品部',
    city: '上海',
    isProbation: true,
    probationSalary: 10000,
    regularSalary: 18000,
  },
  {
    employeeNo: 'EMP003',
    name: '王五',
    department: '市场部',
    city: '成都',
    isProbation: false,
    probationSalary: 8000,
    regularSalary: 35000,
  },
  {
    employeeNo: 'EMP004',
    name: '赵六',
    department: '财务部',
    city: '北京',
    isProbation: false,
    probationSalary: 0,
    regularSalary: 5000,
  },
  {
    employeeNo: 'EMP005',
    name: '钱七',
    department: '人事部',
    city: '北京',
    isProbation: false,
    probationSalary: 0,
    regularSalary: 12000,
  },
  {
    employeeNo: 'EMP006',
    name: '孙八',
    department: '技术部',
    city: '上海',
    isProbation: false,
    probationSalary: 0,
    regularSalary: 15000,
  },
];

export function generateSampleSalaries(
  employeeIdMap: Map<string, string>,
  year: number
): Omit<SalaryDetail, 'id' | 'createdAt'>[] {
  const salaries: Omit<SalaryDetail, 'id' | 'createdAt'>[] = [];

  const employee1Id = employeeIdMap.get('EMP001')!;
  const employee2Id = employeeIdMap.get('EMP002')!;
  const employee3Id = employeeIdMap.get('EMP003')!;
  const employee4Id = employeeIdMap.get('EMP004')!;
  const employee5Id = employeeIdMap.get('EMP005')!;
  const employee6Id = employeeIdMap.get('EMP006')!;

  for (let month = 1; month <= 12; month++) {
    salaries.push({
      employeeId: employee1Id,
      year,
      month,
      baseSalary: 25000,
      bonus: month === 12 ? 25000 : 5000,
      allowance: 2000,
      totalSalary: 25000 + (month === 12 ? 25000 : 5000) + 2000,
    });
  }

  for (let month = 7; month <= 12; month++) {
    salaries.push({
      employeeId: employee2Id,
      year,
      month,
      baseSalary: 10000,
      bonus: 0,
      allowance: 1500,
      totalSalary: 11500,
    });
  }

  for (let month = 1; month <= 12; month++) {
    salaries.push({
      employeeId: employee3Id,
      year,
      month,
      baseSalary: 35000,
      bonus: month === 6 ? 50000 : month === 12 ? 35000 : 3000,
      allowance: 3000,
      totalSalary:
        35000 +
        (month === 6 ? 50000 : month === 12 ? 35000 : 3000) +
        3000,
    });
  }

  for (let month = 1; month <= 3; month++) {
    salaries.push({
      employeeId: employee4Id,
      year,
      month,
      baseSalary: 5000,
      bonus: 0,
      allowance: 500,
      totalSalary: 5500,
    });
  }

  for (let month = 1; month <= 12; month++) {
    salaries.push({
      employeeId: employee5Id,
      year,
      month,
      baseSalary: 12000,
      bonus: month === 12 ? 12000 : 0,
      allowance: 1000,
      totalSalary: 12000 + (month === 12 ? 12000 : 0) + 1000,
    });
  }

  for (let month = 1; month <= 4; month++) {
    salaries.push({
      employeeId: employee6Id,
      year,
      month,
      baseSalary: 12000,
      bonus: 0,
      allowance: 1500,
      totalSalary: 13500,
    });
  }
  for (let month = 5; month <= 12; month++) {
    salaries.push({
      employeeId: employee6Id,
      year,
      month,
      baseSalary: 15000,
      bonus: month === 12 ? 15000 : 0,
      allowance: 2000,
      totalSalary: 15000 + (month === 12 ? 15000 : 0) + 2000,
    });
  }

  return salaries;
}

export function generateSampleEmploymentRecords(
  employeeIdMap: Map<string, string>,
  year: number
): Omit<EmploymentRecord, 'id' | 'createdAt'>[] {
  const records: Omit<EmploymentRecord, 'id' | 'createdAt'>[] = [];

  const employee1Id = employeeIdMap.get('EMP001')!;
  const employee2Id = employeeIdMap.get('EMP002')!;
  const employee3Id = employeeIdMap.get('EMP003')!;
  const employee4Id = employeeIdMap.get('EMP004')!;
  const employee5Id = employeeIdMap.get('EMP005')!;
  const employee6Id = employeeIdMap.get('EMP006')!;

  records.push({
    employeeId: employee1Id,
    type: 'hire',
    date: `${year - 2}-03-15`,
    operator: 'HR-SYSTEM',
    reason: '新员工入职',
  });

  records.push({
    employeeId: employee2Id,
    type: 'hire',
    date: `${year}-07-01`,
    operator: 'HR-小张',
    reason: '新员工入职',
  });

  records.push({
    employeeId: employee3Id,
    type: 'hire',
    date: `${year - 3}-05-20`,
    operator: 'HR-SYSTEM',
    reason: '新员工入职',
  });

  records.push({
    employeeId: employee4Id,
    type: 'hire',
    date: `${year - 5}-01-10`,
    operator: 'HR-SYSTEM',
    reason: '新员工入职',
  });

  records.push({
    employeeId: employee4Id,
    type: 'resign',
    date: `${year}-03-31`,
    operator: 'HR-小李',
    reason: '个人原因离职',
  });

  records.push({
    employeeId: employee5Id,
    type: 'hire',
    date: `${year - 1}-02-28`,
    operator: 'HR-SYSTEM',
    reason: '新员工入职',
  });

  records.push({
    employeeId: employee6Id,
    type: 'hire',
    date: `${year - 4}-08-15`,
    operator: 'HR-SYSTEM',
    reason: '新员工入职',
  });

  records.push({
    employeeId: employee6Id,
    type: 'transfer',
    date: `${year}-05-01`,
    fromCity: '北京',
    toCity: '上海',
    operator: 'HR-小王',
    reason: '跨城市调动',
  });

  return records;
}

export const SAMPLE_CITY_RULES: CityRule[] = [
  {
    city: '北京',
    year: 2025,
    minBase: 6957,
    maxBase: 35283,
    effectiveDate: '2025-07-01',
    note: '北京2025年度社保缴费基数上下限',
  },
  {
    city: '上海',
    year: 2025,
    minBase: 7500,
    maxBase: 38000,
    effectiveDate: '2025-07-01',
    note: '上海2025年度社保缴费基数上下限',
  },
  {
    city: '成都',
    year: 2025,
    minBase: 4500,
    maxBase: 25000,
    effectiveDate: '2025-07-01',
    note: '成都2025年度社保缴费基数上下限',
  },
];

export function generateSampleHistoricalDeclarations(
  employeeIdMap: Map<string, string>,
  year: number
): Omit<HistoricalDeclaration, 'id' | 'createdAt' | 'updatedAt'>[] {
  const declarations: Omit<
    HistoricalDeclaration,
    'id' | 'createdAt' | 'updatedAt'
  >[] = [];

  const employee1Id = employeeIdMap.get('EMP001')!;
  const employee5Id = employeeIdMap.get('EMP005')!;

  declarations.push({
    employeeId: employee1Id,
    year: year - 1,
    declarationMonth: 6,
    baseAmount: 32000,
    startMonth: 7,
    endMonth: 12,
    operator: 'HR-SYSTEM',
    status: 'approved',
  });

  declarations.push({
    employeeId: employee5Id,
    year,
    declarationMonth: 3,
    baseAmount: 12000,
    startMonth: 3,
    endMonth: 6,
    operator: 'HR-小张',
    status: 'submitted',
  });

  return declarations;
}
