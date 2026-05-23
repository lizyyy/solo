const db = require('../src/utils/database');
const initDatabase = require('../src/utils/initDB');
const { TaskService } = require('../src/models/TaskService');

console.log('开始初始化示例数据...\n');

initDatabase();

const properties = [
  { name: '海景公寓 A-101', address: '海南省三亚市海棠湾路88号', roomCount: 2 },
  { name: '山景别墅 B-202', address: '云南省丽江市古城区束河古镇', roomCount: 3 },
  { name: '城市民宿 C-303', address: '浙江省杭州市西湖区文三路123号', roomCount: 1 }
];

const insertProperty = db.prepare(`
  INSERT OR IGNORE INTO properties (name, address, room_count, status)
  VALUES (?, ?, ?, 'active')
`);

properties.forEach(p => {
  insertProperty.run(p.name, p.address, p.roomCount);
  console.log(`✓ 房源: ${p.name}`);
});

console.log('');

const checkItemCategories = [
  { category: '卧室', items: ['床铺整洁', '床单被套更换', '枕头摆放整齐', '床头柜清洁', '衣柜整理', '窗户玻璃清洁', '地面无垃圾'] },
  { category: '卫生间', items: ['马桶清洁消毒', '洗手台清洁', '镜子擦亮', '淋浴间清洁', '浴巾毛巾配齐', '洗漱用品补充', '地漏疏通', '垃圾桶清空'] },
  { category: '厨房', items: ['台面清洁', '碗筷清洗消毒', '厨具归位', '冰箱清洁除霜', '微波炉清洁', '垃圾桶清空', '地面无油污'] },
  { category: '客厅', items: ['沙发整理', '茶几清洁', '电视柜灰尘清理', '窗户清洁', '地面清扫拖地', '垃圾清空', '绿植浇水'] },
  { category: '公共区域', items: ['楼道清洁', '电梯擦拭', '阳台打扫', '门窗检查'] },
  { category: '设施检查', items: ['空调运行正常', '热水器工作正常', 'WiFi信号正常', '门锁功能正常', '灯具全部亮', '水电无泄漏'] }
];

const insertCheckItem = db.prepare(`
  INSERT OR IGNORE INTO check_items (category, name, description, is_required, sort_order, status)
  VALUES (?, ?, ?, 1, ?, 'active')
`);

let itemCount = 0;
checkItemCategories.forEach(cat => {
  cat.items.forEach((item, index) => {
    insertCheckItem.run(cat.category, item, `${cat.category} - ${item}`, index);
    itemCount++;
  });
  console.log(`✓ ${cat.category}: ${cat.items.length} 项检查`);
});

console.log(`\n总计: ${properties.length} 个房源, ${itemCount} 项检查\n`);

const taskData = [
  { propertyId: 1, taskDate: '2024-01-15', cleanerName: '李阿姨', status: 'completed' },
  { propertyId: 1, taskDate: '2024-01-16', cleanerName: '李阿姨', status: 'in_progress' },
  { propertyId: 2, taskDate: '2024-01-15', cleanerName: '张大姐', status: 'accepted' },
  { propertyId: 3, taskDate: '2024-01-15', cleanerName: '王阿姨', status: 'pending' }
];

const insertTask = db.prepare(`
  INSERT OR IGNORE INTO cleaning_tasks (property_id, task_date, cleaner_name, status, notes)
  VALUES (?, ?, ?, ?, ?)
`);

taskData.forEach(t => {
  const result = insertTask.run(t.propertyId, t.taskDate, t.cleanerName, t.status, '例行保洁任务');
  const taskId = result.lastInsertRowid;
  if (taskId) {
    TaskService.initializeTaskCheckItems(taskId, t.propertyId);
  }
  console.log(`✓ 保洁任务: 房源 ${t.propertyId} - ${t.taskDate} - ${t.cleanerName}`);
});

console.log('');

const complaints = [
  { propertyId: 1, complaintDate: '2024-01-16', complainant: '张先生', category: '清洁', description: '卫生间有异味，地漏堵塞', status: 'open' },
  { propertyId: 2, complaintDate: '2024-01-17', complainant: '李女士', category: '设施', description: '空调遥控器无法使用', status: 'resolved' }
];

const insertComplaint = db.prepare(`
  INSERT OR IGNORE INTO complaint_records (property_id, complaint_date, complainant, category, description, status)
  VALUES (?, ?, ?, ?, ?, ?)
`);

complaints.forEach(c => {
  insertComplaint.run(c.propertyId, c.complaintDate, c.complainant, c.category, c.description, c.status);
  console.log(`✓ 客诉记录: ${c.complainant} - ${c.category}`);
});

console.log('\n========================================');
console.log('  示例数据初始化完成！');
console.log('========================================\n');

console.log('统计信息：');
console.log(`  - 房源: ${db.prepare('SELECT COUNT(*) as count FROM properties').get().count} 个`);
console.log(`  - 检查项: ${db.prepare('SELECT COUNT(*) as count FROM check_items').get().count} 项`);
console.log(`  - 保洁任务: ${db.prepare('SELECT COUNT(*) as count FROM cleaning_tasks').get().count} 个`);
console.log(`  - 客诉记录: ${db.prepare('SELECT COUNT(*) as count FROM complaint_records').get().count} 条`);
console.log('\n');
