const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const services = require('../src/services');
const utils = require('../src/utils');

const run = async () => {
  console.log('开始初始化样例数据...\n');
  
  await services.ensureDb();
  
  const deptIT = await services.createDepartment({ id: 'dept-it', name: '信息技术部', budget_amount: 5000 });
  const deptHR = await services.createDepartment({ id: 'dept-hr', name: '人力资源部', budget_amount: 3000 });
  const deptSales = await services.createDepartment({ id: 'dept-sales', name: '销售部', budget_amount: 10000 });
  console.log('✅ 创建部门:', deptIT.name, deptHR.name, deptSales.name);
  
  const stall1 = await services.createStall({ id: 'stall-1', name: '中式快餐档口', location: '一楼A区' });
  const stall2 = await services.createStall({ id: 'stall-2', name: '日式料理档口', location: '一楼B区' });
  const stall3 = await services.createStall({ id: 'stall-3', name: '咖啡简餐档口', location: '二楼' });
  console.log('✅ 创建档口:', stall1.name, stall2.name, stall3.name);
  
  const today = utils.formatDate(new Date());
  
  const appt1 = await services.createAppointment({
    id: 'appt-normal-001',
    visitor_name: '张三',
    visitor_phone: '13800138001',
    visitor_company: '阿里巴巴科技有限公司',
    host_department_id: deptIT.id,
    host_name: '李工',
    appointment_date: today,
    appointment_time: '09:30'
  });
  console.log('✅ 创建预约 [正常流程]:', appt1.visitor_name);
  
  const appt2 = await services.createAppointment({
    id: 'appt-expired-001',
    visitor_name: '李四',
    visitor_phone: '13800138002',
    visitor_company: '腾讯科技',
    host_department_id: deptHR.id,
    host_name: '王经理',
    appointment_date: today,
    appointment_time: '10:00'
  });
  console.log('✅ 创建预约 [过期回收]:', appt2.visitor_name);
  
  const appt3 = await services.createAppointment({
    id: 'appt-budget-001',
    visitor_name: '王五',
    visitor_phone: '13800138003',
    visitor_company: '华为技术',
    host_department_id: deptSales.id,
    host_name: '赵总',
    appointment_date: today,
    appointment_time: '14:00'
  });
  console.log('✅ 创建预约 [预算不足测试]:', appt3.visitor_name);
  
  const appt4 = await services.createAppointment({
    id: 'appt-duplicate-001',
    visitor_name: '钱六',
    visitor_phone: '13800138004',
    visitor_company: '字节跳动',
    host_department_id: deptIT.id,
    host_name: '孙工程师',
    appointment_date: today,
    appointment_time: '11:00'
  });
  console.log('✅ 创建预约 [重复领券测试]:', appt4.visitor_name);
  
  const appt5 = await services.createAppointment({
    id: 'appt-void-001',
    visitor_name: '孙七',
    visitor_phone: '13800138005',
    visitor_company: '美团',
    host_department_id: deptSales.id,
    host_name: '周经理',
    appointment_date: today,
    appointment_time: '15:30'
  });
  console.log('✅ 创建预约 [作废测试]:', appt5.visitor_name);
  
  console.log('\n✅ 样例数据初始化完成');
  console.log('\n部门预算情况:');
  const depts = await services.listDepartments();
  depts.forEach(d => {
    console.log(`  - ${d.name}: 总额¥${d.budget_amount}, 已用¥${d.used_amount}, 剩余¥${d.remaining_budget}`);
  });
};

run().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
