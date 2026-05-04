import { initializeSchema, dropAllTables } from '../database/schema';
import { employeeRepository } from '../repositories/EmployeeRepository';
import { payrollRepository } from '../repositories/PayrollRepository';
import { logger } from '../utils/logger';

const BANK_NAMES = [
  '中国工商银行',
  '中国建设银行',
  '中国农业银行',
  '中国银行',
  '交通银行',
  '招商银行',
  '浦发银行',
  '民生银行',
  '兴业银行',
  '中信银行',
  '光大银行',
  '华夏银行',
  '平安银行',
  '浙商银行',
  '中国邮政储蓄银行'
];

const DEPARTMENTS = [
  '技术研发部',
  '产品部',
  '市场部',
  '销售部',
  '人力资源部',
  '财务部',
  '行政部',
  '客户服务部',
  '质量保证部',
  '运营部'
];

const POSITIONS = [
  '高级工程师',
  '工程师',
  '初级工程师',
  '技术总监',
  '产品经理',
  '高级产品经理',
  '产品总监',
  '市场专员',
  '市场经理',
  '销售代表',
  '销售经理',
  '销售总监',
  '人力资源专员',
  '人力资源经理',
  '财务会计',
  '财务经理',
  '行政助理',
  '行政经理',
  '客服专员',
  '客服经理'
];

const CHINESE_SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
  '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎'
];

const CHINESE_GIVEN_NAMES = [
  '伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军',
  '洋', '勇', '艳', '杰', '涛', '明', '超', '秀兰', '霞', '平',
  '刚', '桂英', '文', '华', '玲', '辉', '鑫', '斌', '波', '宇',
  '浩', '凯', '健', '俊', '帅', '航', '博', '豪', '瑞', '恒',
  '晨', '阳', '旭', '松', '霖', '杰', '文轩', '浩宇', '浩然',
  '子轩', '雨泽', '文博', '天佑', '英杰', '皓轩', '擎宇', '志泽'
];

function generateRandomName(): string {
  const surname = CHINESE_SURNAMES[Math.floor(Math.random() * CHINESE_SURNAMES.length)];
  const givenName = CHINESE_GIVEN_NAMES[Math.floor(Math.random() * CHINESE_GIVEN_NAMES.length)];
  return surname + givenName;
}

function generateRandomEmail(name: string, index: number): string {
  const domains = ['gmail.com', 'outlook.com', 'qq.com', '163.com', 'company.com'];
  const pinyinName = name
    .replace(/[\u4e00-\u9fa5]/g, (c) => String.fromCharCode(0x61 + (c.charCodeAt(0) % 26)))
    .toLowerCase();
  return `${pinyinName}${index}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

function generateRandomPhone(): string {
  const prefixes = ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139',
    '150', '151', '152', '153', '155', '156', '157', '158', '159',
    '180', '181', '182', '183', '184', '185', '186', '187', '188', '189'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return prefix + suffix;
}

function generateBankAccountNumber(): string {
  const length = 16 + Math.floor(Math.random() * 4);
  let accountNumber = '';
  for (let i = 0; i < length; i++) {
    accountNumber += Math.floor(Math.random() * 10).toString();
  }
  return accountNumber;
}

function generateBaseSalary(): number {
  const baseSalaryRanges = [
    { min: 8000, max: 15000 },
    { min: 15000, max: 25000 },
    { min: 25000, max: 40000 },
    { min: 40000, max: 60000 },
    { min: 60000, max: 100000 }
  ];
  const range = baseSalaryRanges[Math.floor(Math.random() * baseSalaryRanges.length)];
  return Math.floor((range.min + Math.random() * (range.max - range.min)) / 100) * 100;
}

interface SeedOptions {
  employeeCount: number;
  year: number;
  month: number;
  resetDatabase: boolean;
}

async function seed(options: SeedOptions): Promise<void> {
  logger.info('Starting seed process', { options });

  if (options.resetDatabase) {
    logger.warn('Resetting database...');
    await dropAllTables();
  }

  await initializeSchema();

  logger.info('Generating employees...', { count: options.employeeCount });

  const employees = [];
  const usedEmails = new Set<string>();
  const usedEmployeeNumbers = new Set<string>();

  for (let i = 0; i < options.employeeCount; i++) {
    const name = generateRandomName();
    const employeeNumber = `EMP${String(i + 1).padStart(8, '0')}`;
    let email = generateRandomEmail(name, i);
    
    let emailSuffix = 0;
    while (usedEmails.has(email)) {
      emailSuffix++;
      email = generateRandomEmail(name, i + emailSuffix * 1000);
    }
    usedEmails.add(email);
    usedEmployeeNumbers.add(employeeNumber);

    employees.push({
      employeeNumber,
      name,
      email,
      phone: generateRandomPhone(),
      bankName: BANK_NAMES[Math.floor(Math.random() * BANK_NAMES.length)],
      bankAccountNumber: generateBankAccountNumber(),
      bankAccountName: name,
      department: DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)],
      position: POSITIONS[Math.floor(Math.random() * POSITIONS.length)]
    });
  }

  logger.info('Creating employees in database...');
  const createdEmployees = await employeeRepository.bulkCreate(employees);
  logger.info('Employees created', { count: createdEmployees.length });

  logger.info('Generating payrolls...', { 
    year: options.year, 
    month: options.month 
  });

  const payrolls = createdEmployees.map(employee => ({
    employeeId: employee.id,
    baseSalary: generateBaseSalary(),
    bonus: Math.floor(Math.random() * 10000),
    allowance: Math.floor(Math.random() * 5000),
    deduction: Math.floor(Math.random() * 2000),
    tax: Math.floor(Math.random() * 5000),
    socialInsurance: Math.floor(Math.random() * 3000),
    housingFund: Math.floor(Math.random() * 5000),
    year: options.year,
    month: options.month
  }));

  logger.info('Creating payrolls in database...');
  const createdPayrolls = await payrollRepository.bulkCreate(payrolls);
  logger.info('Payrolls created', { count: createdPayrolls.length });

  const totalNetSalary = createdPayrolls.reduce((sum, p) => sum + p.netSalary, 0);

  logger.info('Seed completed successfully!', {
    employees: createdEmployees.length,
    payrolls: createdPayrolls.length,
    year: options.year,
    month: options.month,
    totalNetSalary: totalNetSalary.toFixed(2)
  });

  console.log('\n' + '='.repeat(60));
  console.log('Seed Summary:');
  console.log('='.repeat(60));
  console.log(`Employees: ${createdEmployees.length}`);
  console.log(`Payrolls: ${createdPayrolls.length}`);
  console.log(`Period: ${options.year}-${String(options.month).padStart(2, '0')}`);
  console.log(`Total Net Salary: ¥${totalNetSalary.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`);
  console.log('='.repeat(60));
}

async function main() {
  const args = process.argv.slice(2);
  const options: SeedOptions = {
    employeeCount: 1000,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    resetDatabase: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--count':
      case '-c':
        options.employeeCount = parseInt(args[++i] || '1000');
        break;
      case '--year':
      case '-y':
        options.year = parseInt(args[++i] || String(new Date().getFullYear()));
        break;
      case '--month':
      case '-m':
        options.month = parseInt(args[++i] || String(new Date().getMonth() + 1));
        break;
      case '--reset':
      case '-r':
        options.resetDatabase = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npm run seed [options]

Options:
  --count, -c <number>  Number of employees to generate (default: 1000)
  --year, -y <number>   Year for payrolls (default: current year)
  --month, -m <number>  Month for payrolls (default: current month)
  --reset, -r           Reset database before seeding
  --help, -h            Show this help message

Examples:
  npm run seed -- --count 10000 --reset
  npm run seed -- -c 5000 -y 2024 -m 5
        `);
        process.exit(0);
    }
  }

  try {
    await seed(options);
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  }
}

main();
