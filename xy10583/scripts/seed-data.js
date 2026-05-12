const store = require('../data/store');

console.log('正在初始化样例数据...');

store.resetData();

const drivers = [
  { id: 'DRV001', name: '张三', phone: '13800138001', status: 'active' },
  { id: 'DRV002', name: '李四', phone: '13800138002', status: 'active' },
  { id: 'DRV003', name: '王五', phone: '13800138003', status: 'active' }
];

drivers.forEach(d => store.saveDriver(d));

const departments = [
  { code: 'SALES', name: '销售部', budget: 50000, spent: 0, remaining: 50000 },
  { code: 'TECH', name: '技术部', budget: 30000, spent: 0, remaining: 30000 },
  { code: 'HR', name: '人事部', budget: 20000, spent: 0, remaining: 20000 },
  { code: 'FINANCE', name: '财务部', budget: 15000, spent: 0, remaining: 15000 },
  { code: 'ADMIN', name: '行政部', budget: 10000, spent: 0, remaining: 10000 }
];

departments.forEach(d => store.saveDepartment(d));

console.log('初始化完成！');
console.log('\n=== 初始化数据 ===');
console.log('司机数量:', drivers.length);
console.log('部门数量:', departments.length);
console.log('\n=== 司机列表 ===');
drivers.forEach(d => console.log(`  - ${d.id}: ${d.name}`));
console.log('\n=== 部门预算 ===');
departments.forEach(d => console.log(`  - ${d.code}: ${d.name} (预算: ¥${d.budget.toLocaleString()})`));
