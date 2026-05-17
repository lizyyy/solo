const db = require('../database/memoryDB');
const { BORROW_STATUS } = require('../models/BorrowRecord');
const { REMINDER_TYPE, REMINDER_STATUS } = require('../models/ReminderRecord');

function initTestData() {
  console.log('  🔄 初始化测试数据...');

  const assets = [
    { id: 'asset_1', name: 'MacBook Pro 16寸', category: '电脑', sn: 'MBP2024001', location: '研发部', purchaseDate: '2024-01-15' },
    { id: 'asset_2', name: 'Dell 显示器 27寸', category: '外设', sn: 'DEL2024002', location: '研发部', purchaseDate: '2024-02-20' },
    { id: 'asset_3', name: 'iPhone 15 Pro', category: '手机', sn: 'IP15P003', location: '市场部', purchaseDate: '2024-03-10' },
    { id: 'asset_4', name: '罗技键盘 MX Keys', category: '外设', sn: 'LOG2024004', location: '人事部', purchaseDate: '2024-04-05' },
    { id: 'asset_5', name: 'iPad Pro 12.9', category: '平板', sn: 'IPADP005', location: '设计部', purchaseDate: '2024-05-12' }
  ];

  assets.forEach(a => db.addAsset(a));
  console.log(`    ✅ 资产数据: ${assets.length} 条`);

  const users = [
    { id: 'user_1', name: '张三', email: 'zhangsan@example.com', phone: '13800138001', departmentId: 'dept_dev', departmentName: '研发部', employeeId: 'EMP001' },
    { id: 'user_2', name: '李四', email: 'lisi@example.com', phone: '13800138002', departmentId: 'dept_market', departmentName: '市场部', employeeId: 'EMP002' },
    { id: 'user_3', name: '王五', email: 'wangwu@example.com', phone: '13800138003', departmentId: 'dept_hr', departmentName: '人事部', employeeId: 'EMP003' },
    { id: 'user_4', name: '赵六', email: 'zhaoliu@example.com', phone: '13800138004', departmentId: 'dept_design', departmentName: '设计部', employeeId: 'EMP004' }
  ];

  users.forEach(u => db.addUser(u));
  console.log(`    ✅ 用户数据: ${users.length} 条`);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekLater = new Date(today);
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const threeWeeksAgo = new Date(today);
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

  const borrowRecords = [
    {
      id: 'borrow_full_flow',
      assetId: 'asset_1',
      userId: 'user_1',
      userName: '张三',
      userDepartmentId: 'dept_dev',
      userDepartmentName: '研发部',
      borrowDate: twoWeeksAgo.toISOString().split('T')[0],
      expectedReturnDate: yesterday.toISOString().split('T')[0],
      actualReturnDate: null,
      status: BORROW_STATUS.OVERDUE,
      purpose: '项目开发使用',
      remark: '场景1: 完整流转测试',
      hasDepartmentConflict: false
    },
    {
      id: 'borrow_conflict',
      assetId: 'asset_3',
      userId: 'user_2',
      userName: '李四',
      userDepartmentId: 'dept_sales',
      userDepartmentName: '销售部',
      borrowDate: oneWeekAgo.toISOString().split('T')[0],
      expectedReturnDate: oneWeekLater.toISOString().split('T')[0],
      actualReturnDate: null,
      status: BORROW_STATUS.BORROWING,
      purpose: '客户拜访使用',
      remark: '场景2: 部门冲突测试 - 借用人已从销售部转到市场部',
      hasDepartmentConflict: false
    },
    {
      id: 'borrow_returned',
      assetId: 'asset_4',
      userId: 'user_3',
      userName: '王五',
      userDepartmentId: 'dept_hr',
      userDepartmentName: '人事部',
      borrowDate: threeWeeksAgo.toISOString().split('T')[0],
      expectedReturnDate: oneWeekAgo.toISOString().split('T')[0],
      actualReturnDate: yesterday.toISOString().split('T')[0],
      status: BORROW_STATUS.RETURNED,
      purpose: '招聘面试使用',
      remark: '已归还记录',
      hasDepartmentConflict: false
    },
    {
      id: 'borrow_borrowing',
      assetId: 'asset_5',
      userId: 'user_4',
      userName: '赵六',
      userDepartmentId: 'dept_design',
      userDepartmentName: '设计部',
      borrowDate: oneWeekAgo.toISOString().split('T')[0],
      expectedReturnDate: tomorrow.toISOString().split('T')[0],
      actualReturnDate: null,
      status: BORROW_STATUS.BORROWING,
      purpose: 'UI设计使用',
      remark: '借用中，即将到期',
      hasDepartmentConflict: false
    }
  ];

  borrowRecords.forEach(b => db.addBorrowRecord(b));
  console.log(`    ✅ 借用记录: ${borrowRecords.length} 条`);

  db.updateUserDepartment('user_2', 'dept_market', '市场部');
  console.log(`    ✅ 模拟用户转部门: 李四 从 销售部 转到 市场部`);

  const reminders = [
    {
      id: 'reminder_1',
      borrowRecordId: 'borrow_full_flow',
      userId: 'user_1',
      userName: '张三',
      type: REMINDER_TYPE.AUTO,
      channel: 'email',
      status: REMINDER_STATUS.SENT,
      content: '【逾期提醒】您借用的 MacBook Pro 16寸 已逾期，请尽快归还',
      sentAt: yesterday.toISOString(),
      remark: '自动逾期提醒'
    }
  ];

  reminders.forEach(r => db.addReminderRecord(r));
  console.log(`    ✅ 催还记录: ${reminders.length} 条`);

  console.log('\n  📋 测试场景说明:');
  console.log('    ─────────────────────────────────────────');
  console.log('    【场景1: 完整流转】');
  console.log('      ID: borrow_full_flow');
  console.log('      状态: 逾期 (OVERDUE)');
  console.log('      流程: 借用中 → 逾期 → 催还中 → 已归还');
  console.log('      操作: POST /api/reminders 创建催还 → POST /api/borrows/:id/return 归还');
  console.log('    ─────────────────────────────────────────');
  console.log('    【场景2: 部门冲突】');
  console.log('      ID: borrow_conflict');
  console.log('      状态: 借用中 (BORROWING)');
  console.log('      冲突: 借用时部门是 销售部，当前是 市场部');
  console.log('      操作: POST /api/reminders 触发冲突 → POST /api/reminders/force 确认后强制发送');
  console.log('    ─────────────────────────────────────────');
  console.log('    【场景3: 导入坏行】');
  console.log('      操作: POST /api/import/test-bad-rows 生成坏行');
  console.log('      查看: GET /api/import/errors 查看错误');
  console.log('    ─────────────────────────────────────────');
  console.log('    【场景4: 互相对照】');
  console.log('      列表: GET /api/borrows');
  console.log('      详情: GET /api/borrows/:id');
  console.log('      历史: GET /api/reminders?borrowRecordId=:id');
  console.log('      导出: GET /api/export/borrows?format=csv/json');
  console.log('    ─────────────────────────────────────────\n');

  return true;
}

module.exports = { initTestData };
