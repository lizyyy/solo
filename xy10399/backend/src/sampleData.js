const { db, prepare, saveDB } = require('./database');

const initSampleData = () => {
  if (db.stores.length > 0) {
    return;
  }

  console.log('🔄 正在初始化样例数据...');

  const stores = [
    { name: '中心店', address: '市中心商业区88号', phone: '010-88888881' },
    { name: '东区店', address: '东区商业街123号', phone: '010-88888882' },
    { name: '西区店', address: '西区万达广场', phone: '010-88888883' },
    { name: '南区店', address: '南区购物中心', phone: '010-88888884' }
  ];

  stores.forEach(store => prepare('stores').insert(store));

  const skills = [
    { name: '收银员', description: '熟练操作收银系统' },
    { name: '导购员', description: '商品推荐和客户服务' },
    { name: '理货员', description: '商品陈列和库存管理' },
    { name: '店长', description: '门店管理和协调' }
  ];

  skills.forEach(skill => prepare('skills').insert(skill));

  const employees = [
    { name: '张三', original_store_id: 1, max_hours_per_week: 40 },
    { name: '李四', original_store_id: 1, max_hours_per_week: 40 },
    { name: '王五', original_store_id: 2, max_hours_per_week: 35 },
    { name: '赵六', original_store_id: 2, max_hours_per_week: 40 },
    { name: '钱七', original_store_id: 3, max_hours_per_week: 38 },
    { name: '孙八', original_store_id: 3, max_hours_per_week: 40 },
    { name: '周九', original_store_id: 4, max_hours_per_week: 40 },
    { name: '吴十', original_store_id: 4, max_hours_per_week: 36 }
  ];

  employees.forEach(emp => prepare('employees').insert(emp));

  const empSkills = [
    { employee_id: 1, skill_id: 1, proficiency_level: 2 },
    { employee_id: 1, skill_id: 2, proficiency_level: 1 },
    { employee_id: 2, skill_id: 1, proficiency_level: 2 },
    { employee_id: 2, skill_id: 3, proficiency_level: 2 },
    { employee_id: 3, skill_id: 2, proficiency_level: 2 },
    { employee_id: 3, skill_id: 4, proficiency_level: 1 },
    { employee_id: 4, skill_id: 1, proficiency_level: 1 },
    { employee_id: 4, skill_id: 2, proficiency_level: 2 },
    { employee_id: 5, skill_id: 3, proficiency_level: 2 },
    { employee_id: 5, skill_id: 1, proficiency_level: 1 },
    { employee_id: 6, skill_id: 2, proficiency_level: 2 },
    { employee_id: 6, skill_id: 4, proficiency_level: 1 },
    { employee_id: 7, skill_id: 1, proficiency_level: 2 },
    { employee_id: 7, skill_id: 2, proficiency_level: 2 },
    { employee_id: 8, skill_id: 3, proficiency_level: 1 },
    { employee_id: 8, skill_id: 2, proficiency_level: 1 }
  ];

  empSkills.forEach(es => prepare('employeeSkills').insert(es));

  const today = new Date();
  const getDateStr = (daysOffset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  };

  const schedules = [
    { employee_id: 1, store_id: 1, date: getDateStr(0), start_time: '09:00', end_time: '18:00', shift_type: 'regular', status: 'original' },
    { employee_id: 2, store_id: 1, date: getDateStr(0), start_time: '10:00', end_time: '19:00', shift_type: 'regular', status: 'original' },
    { employee_id: 3, store_id: 2, date: getDateStr(0), start_time: '08:00', end_time: '17:00', shift_type: 'regular', status: 'original' },
    { employee_id: 4, store_id: 2, date: getDateStr(1), start_time: '09:00', end_time: '18:00', shift_type: 'regular', status: 'original' },
    { employee_id: 5, store_id: 3, date: getDateStr(1), start_time: '10:00', end_time: '19:00', shift_type: 'regular', status: 'original' },
    { employee_id: 6, store_id: 3, date: getDateStr(2), start_time: '08:00', end_time: '17:00', shift_type: 'regular', status: 'original' },
    { employee_id: 7, store_id: 4, date: getDateStr(2), start_time: '09:00', end_time: '18:00', shift_type: 'regular', status: 'original' },
    { employee_id: 8, store_id: 4, date: getDateStr(3), start_time: '10:00', end_time: '19:00', shift_type: 'regular', status: 'original' }
  ];

  schedules.forEach(s => prepare('schedules').insert(s));

  const allowanceRules = [
    { from_store_id: 1, to_store_id: 2, allowance_amount: 25 },
    { from_store_id: 1, to_store_id: 3, allowance_amount: 30 },
    { from_store_id: 1, to_store_id: 4, allowance_amount: 35 },
    { from_store_id: 2, to_store_id: 3, allowance_amount: 20 },
    { from_store_id: 2, to_store_id: 4, allowance_amount: 25 },
    { from_store_id: 3, to_store_id: 4, allowance_amount: 28 }
  ];

  allowanceRules.forEach(r => prepare('transportAllowanceRules').insert(r));

  prepare('transferRequests').insert({
    employee_id: 1,
    from_store_id: 1,
    to_store_id: 2,
    date: getDateStr(-1),
    start_time: '14:00',
    end_time: '22:00',
    skill_required: 1,
    reason: '东区店周末促销支援',
    status: 'approved',
    transport_allowance: 40,
    approver: '张经理',
    approval_comment: '正常借调，同意支援',
    approved_at: new Date().toISOString()
  });

  prepare('schedules').insert({
    employee_id: 1,
    store_id: 2,
    date: getDateStr(-1),
    start_time: '14:00',
    end_time: '22:00',
    shift_type: 'transfer',
    status: 'active'
  });

  prepare('transferRequests').insert({
    employee_id: 2,
    from_store_id: 1,
    to_store_id: 3,
    date: getDateStr(4),
    start_time: '07:00',
    end_time: '17:00',
    skill_required: 1,
    reason: '西区店新品上市高峰支援',
    status: 'pending',
    transport_allowance: 45,
    approver: null,
    approval_comment: null,
    approved_at: null
  });

  prepare('transferRequests').insert({
    employee_id: 5,
    from_store_id: 3,
    to_store_id: 4,
    date: getDateStr(-2),
    start_time: '09:00',
    end_time: '18:00',
    skill_required: null,
    reason: '南区店临时支援',
    status: 'approved',
    transport_allowance: 48,
    approver: '李经理',
    approval_comment: '同意',
    approved_at: new Date().toISOString()
  });

  saveDB();

  console.log('✅ 样例数据初始化完成！');
  console.log('\n📋 样例数据说明：');
  console.log('  - 4家门店：中心店、东区店、西区店、南区店');
  console.log('  - 4种技能：收银员、导购员、理货员、店长');
  console.log('  - 8名员工，每人具备2种技能');
  console.log('  - 已审批的正常借调案例：张三从中心店借调至东区店');
  console.log('  - 高峰缺人案例：李四从中心店到西区店（早7点-晚5点，有高峰补贴）');
  console.log('  - 技能不符测试：可尝试申请需要员工不具备的技能');
  console.log('  - 工时超限测试：可尝试为已排满工时的员工申请借调');
};

module.exports = initSampleData;
