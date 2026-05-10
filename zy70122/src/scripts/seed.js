const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const { initDatabase } = require('../config/database');
const planService = require('../services/planService');
const settlementService = require('../services/settlementService');

async function main() {
  await initDatabase();
  
  console.log('开始插入示例数据...\n');

  const org = planService.createOrganization('示例科技有限公司');
  console.log(`创建组织: ${org.name} (ID: ${org.id})`);

  const employees = [
    { no: 'E001', name: '张三', dept: '研发部' },
    { no: 'E002', name: '李四', dept: '研发部' },
    { no: 'E003', name: '王五', dept: '市场部' },
    { no: 'E004', name: '赵六', dept: '市场部' },
    { no: 'E005', name: '钱七', dept: '人事部' },
  ];

  const createdEmployees = [];
  employees.forEach(emp => {
    const e = planService.createEmployee(org.id, emp.no, emp.name, emp.dept);
    createdEmployees.push(e);
    console.log(`创建员工: ${e.employee_no} ${e.name}`);
  });

  console.log('\n');

  const subsidyRules = [
    {
      name: '中餐补贴（固定金额）',
      type: 'fixed_per_meal',
      fixedAmount: 10,
      effectiveDate: '2025-01-01',
      endDate: null
    },
    {
      name: '晚餐补贴（固定金额）',
      type: 'fixed_per_meal',
      fixedAmount: 15,
      effectiveDate: '2025-01-01',
      endDate: null
    }
  ];

  subsidyRules.forEach(rule => {
    const r = planService.createSubsidyRule({
      organizationId: org.id,
      ruleName: rule.name,
      ruleType: rule.type,
      fixedAmount: rule.fixedAmount,
      percentage: rule.percentage,
      maxAmount: rule.maxAmount,
      effectiveDate: rule.effectiveDate,
      endDate: rule.endDate
    });
    console.log(`创建补贴规则: ${r.rule_name}`);
  });

  console.log('\n');

  const month = 4;
  const year = 2025;
  const daysInMonth = 30;
  const unitPrice = 25;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay());
    if (isWeekend) continue;
    
    const lunchPlan = planService.createMealPlan(
      org.id, dateStr, 'lunch', 5, unitPrice
    );
    console.log(`创建订餐计划: ${dateStr} 午餐 5 份`);
    
    const dinnerPlan = planService.createMealPlan(
      org.id, dateStr, 'dinner', 3, unitPrice
    );
    console.log(`创建订餐计划: ${dateStr} 晚餐 3 份`);
    
    const lunchTakeCount = day % 5 === 0 ? 3 : 5;
    for (let i = 0; i < lunchTakeCount; i++) {
      planService.createMealVerification({
        organizationId: org.id,
        mealPlanId: lunchPlan.id,
        employeeId: createdEmployees[i % createdEmployees.length].id,
        verificationDate: dateStr,
        mealType: 'lunch',
        verificationTime: `12:${String(10 + i * 5).padStart(2, '0')}:00`,
        deviceNo: 'DEVICE-001'
      });
    }
    
    const dinnerTakeCount = day % 3 === 0 ? 2 : 3;
    for (let i = 0; i < dinnerTakeCount; i++) {
      planService.createMealVerification({
        organizationId: org.id,
        mealPlanId: dinnerPlan.id,
        employeeId: createdEmployees[i % createdEmployees.length].id,
        verificationDate: dateStr,
        mealType: 'dinner',
        verificationTime: `18:${String(30 + i * 5).padStart(2, '0')}:00`,
        deviceNo: 'DEVICE-001'
      });
    }
  }

  console.log('\n');
  console.log('示例数据插入完成！');
  console.log(`\n组织ID: ${org.id}`);
  console.log(`\n接下来可以执行以下操作:`);
  console.log(`  npm run cli -- settle:create ${org.id} 2025 4`);
  console.log(`  npm run cli -- settle:calc <cycleId>`);
  console.log(`  npm run cli -- settle:report <cycleId>`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
