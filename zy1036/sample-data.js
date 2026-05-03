const db = require('./database');
const dayjs = require('dayjs');

console.log('正在初始化示例数据...');

const data = db.loadData();

data.owners = [];
data.pets = [];
data.orders = [];
data.todos = [];
data.incidents = [];
data.operation_logs = [];

const owner1 = {
  id: db.generateId(),
  name: '张三',
  phone: '13800138001',
  emergency_name: '张母',
  emergency_phone: '13900139001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const owner2 = {
  id: db.generateId(),
  name: '李四',
  phone: '13800138002',
  emergency_name: '李父',
  emergency_phone: '13900139002',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const owner3 = {
  id: db.generateId(),
  name: '王五',
  phone: '13800138003',
  emergency_name: '',
  emergency_phone: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

data.owners.push(owner1, owner2, owner3);

const pet1 = {
  id: db.generateId(),
  name: '大黄',
  type: '狗',
  breed: '金毛',
  weight: 28.5,
  gender: 'male',
  birthday: '2021-03-15',
  owner_id: owner1.id,
  personality: '性格温顺，喜欢和人亲近，不挑食',
  health_notes: '对玉米过敏，不能吃玉米',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const pet2 = {
  id: db.generateId(),
  name: '咪咪',
  type: '猫',
  breed: '布偶',
  weight: 5.2,
  gender: 'female',
  birthday: '2022-07-20',
  owner_id: owner2.id,
  personality: '比较粘人，但陌生人靠近会害怕',
  health_notes: '有慢性肾病，需要定期喂药，多喝水',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const pet3 = {
  id: db.generateId(),
  name: '豆豆',
  type: '狗',
  breed: '柯基',
  weight: 12.3,
  gender: 'male',
  birthday: '2023-01-10',
  owner_id: owner3.id,
  personality: '活泼好动，喜欢追球，有点护食',
  health_notes: '曾患过细小，已康复，定期打疫苗',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const pet4 = {
  id: db.generateId(),
  name: '花花',
  type: '狗',
  breed: '拉布拉多',
  weight: 35,
  gender: 'female',
  birthday: '2020-11-05',
  owner_id: owner1.id,
  personality: '导盲犬后代，性格非常稳定，训练有素',
  health_notes: '髋关节有轻微发育不良，避免剧烈运动',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

data.pets.push(pet1, pet2, pet3, pet4);

const today = dayjs();
const yesterday = today.subtract(1, 'day');
const tomorrow = today.add(1, 'day');
const dayAfterTomorrow = today.add(2, 'days');
const threeDaysLater = today.add(3, 'days');

const cage1 = data.cages[0] || { id: 'cage-1', name: '笼位 1' };
const cage2 = data.cages[1] || { id: 'cage-2', name: '笼位 2' };
const cage3 = data.cages[2] || { id: 'cage-3', name: '笼位 3' };

const order1 = {
  id: db.generateId(),
  pet_id: pet1.id,
  pet_name: pet1.name,
  owner_id: owner1.id,
  owner_name: owner1.name,
  cage_id: cage1.id,
  cage_name: cage1.name,
  check_in_date: yesterday.format('YYYY-MM-DD'),
  check_out_date: threeDaysLater.format('YYYY-MM-DD'),
  feeding_instructions: '每天早晚各喂一次，每次 150g 狗粮，中午可以加一点鸡胸肉，确保充足饮水',
  medication_plan: '无需用药',
  transportation: 'owner',
  special_requirements: '每天需要至少 2 次遛弯，每次 30 分钟以上，主人会自带狗粮',
  status: 'checked_in',
  check_in_time: yesterday.subtract(2, 'hour').toISOString(),
  check_out_time: null,
  check_in_notes: '宠物状态良好，精神饱满，已检查身体无外伤',
  check_out_notes: '',
  created_at: yesterday.subtract(1, 'day').toISOString(),
  updated_at: yesterday.toISOString()
};

const order2 = {
  id: db.generateId(),
  pet_id: pet2.id,
  pet_name: pet2.name,
  owner_id: owner2.id,
  owner_name: owner2.name,
  cage_id: cage2.id,
  cage_name: cage2.name,
  check_in_date: today.format('YYYY-MM-DD'),
  check_out_date: dayAfterTomorrow.format('YYYY-MM-DD'),
  feeding_instructions: '每天少量多餐，猫粮放在固定位置，它自己会吃，需要每天换新鲜水',
  medication_plan: '每天早上喂肾病专用药 1 粒，混在罐头里喂',
  transportation: 'delivery',
  special_requirements: '猫砂盆需要每天清理，它比较爱干净，环境不能太吵',
  status: 'pending',
  check_in_time: null,
  check_out_time: null,
  check_in_notes: '',
  check_out_notes: '',
  created_at: yesterday.toISOString(),
  updated_at: yesterday.toISOString()
};

const order3 = {
  id: db.generateId(),
  pet_id: pet3.id,
  pet_name: pet3.name,
  owner_id: owner3.id,
  owner_name: owner3.name,
  cage_id: cage3.id,
  cage_name: cage3.name,
  check_in_date: tomorrow.format('YYYY-MM-DD'),
  check_out_date: threeDaysLater.format('YYYY-MM-DD'),
  feeding_instructions: '早晚各一次，每次 100g，它有点护食，喂食时注意安全',
  medication_plan: '无需用药',
  transportation: 'owner',
  special_requirements: '每天需要运动，可以带它玩球，不要让它爬楼梯',
  status: 'pending',
  check_in_time: null,
  check_out_time: null,
  check_in_notes: '',
  check_out_notes: '',
  created_at: yesterday.toISOString(),
  updated_at: yesterday.toISOString()
};

data.orders.push(order1, order2, order3);

const todo1 = {
  id: db.generateId(),
  order_id: order1.id,
  type: 'check_in',
  title: `${order1.pet_name} 到店`,
  description: '已确认到店',
  due_date: order1.check_in_date,
  status: 'completed',
  created_at: yesterday.toISOString(),
  completed_at: order1.check_in_time,
  completed_by: 'system',
  notes: '宠物状态良好，已确认入住'
};

const todo2 = {
  id: db.generateId(),
  order_id: order1.id,
  type: 'check_out',
  title: `${order1.pet_name} 离店`,
  description: '请确认宠物离店',
  due_date: order1.check_out_date,
  status: 'pending',
  created_at: yesterday.toISOString(),
  completed_at: null,
  completed_by: null,
  notes: ''
};

const todo3 = {
  id: db.generateId(),
  order_id: order2.id,
  type: 'check_in',
  title: `${order2.pet_name} 到店`,
  description: '请确认宠物已到店，检查健康状态',
  due_date: order2.check_in_date,
  status: 'pending',
  created_at: yesterday.toISOString(),
  completed_at: null,
  completed_by: null,
  notes: ''
};

const todo4 = {
  id: db.generateId(),
  order_id: order2.id,
  type: 'check_out',
  title: `${order2.pet_name} 离店`,
  description: '请确认宠物离店',
  due_date: order2.check_out_date,
  status: 'pending',
  created_at: yesterday.toISOString(),
  completed_at: null,
  completed_by: null,
  notes: ''
};

const todo5 = {
  id: db.generateId(),
  order_id: order2.id,
  type: 'medication',
  title: `${order2.pet_name} 喂药`,
  description: '今天早上需要喂肾病药',
  due_date: today.format('YYYY-MM-DD'),
  status: 'pending',
  created_at: yesterday.toISOString(),
  completed_at: null,
  completed_by: null,
  notes: ''
};

data.todos.push(todo1, todo2, todo3, todo4, todo5);

const incident1 = {
  id: db.generateId(),
  order_id: order1.id,
  pet_id: order1.pet_id,
  type: '食欲下降',
  severity: 'low',
  description: '今天早上发现大黄食欲不太好，只吃了平时一半的量，精神还可以',
  image_paths: [],
  resolved: false,
  resolved_at: null,
  resolution: '',
  created_at: today.subtract(2, 'hour').toISOString(),
  updated_at: today.subtract(2, 'hour').toISOString()
};

data.incidents.push(incident1);

const incidentTodo = {
  id: db.generateId(),
  order_id: order1.id,
  type: 'incident',
  title: `${order1.pet_name} - 异常事件跟进`,
  description: `异常类型: 食欲下降\n严重程度: 低\n今天早上发现大黄食欲不太好`,
  due_date: today.format('YYYY-MM-DD'),
  status: 'pending',
  created_at: today.subtract(2, 'hour').toISOString(),
  completed_at: null,
  completed_by: null,
  notes: '',
  incident_id: incident1.id
};

data.todos.push(incidentTodo);

db.saveData(data);

console.log('✅ 示例数据创建成功！');
console.log('');
console.log('📊 创建的示例数据：');
console.log('');
console.log('👤 主人 (3个):');
console.log(`   - 张三 (${owner1.phone}) - 大黄、花花`);
console.log(`   - 李四 (${owner2.phone}) - 咪咪`);
console.log(`   - 王五 (${owner3.phone}) - 豆豆`);
console.log('');
console.log('🐾 宠物 (4个):');
console.log(`   - 大黄 (金毛 ♂ 28.5kg) - 张三`);
console.log(`   - 咪咪 (布偶 ♀ 5.2kg) - 李四`);
console.log(`   - 豆豆 (柯基 ♂ 12.3kg) - 王五`);
console.log(`   - 花花 (拉布拉多 ♀ 35kg) - 张三`);
console.log('');
console.log('📋 寄养订单 (3个):');
console.log(`   1. 大黄 - 状态: 已入住`);
console.log(`      入住: ${order1.check_in_date} → 离店: ${order1.check_out_date}`);
console.log(`      笼位: ${order1.cage_name}`);
console.log('');
console.log(`   2. 咪咪 - 状态: 待入住 (今日待办)`);
console.log(`      入住: ${order2.check_in_date} → 离店: ${order2.check_out_date}`);
console.log(`      笼位: ${order2.cage_name}`);
console.log(`      ⚠️ 注意: 需要喂肾病药`);
console.log('');
console.log(`   3. 豆豆 - 状态: 待入住 (明天)`);
console.log(`      入住: ${order3.check_in_date} → 离店: ${order3.check_out_date}`);
console.log(`      笼位: ${order3.cage_name}`);
console.log('');
console.log('🚨 异常事件 (1个):');
console.log(`   - 大黄 - 食欲下降 (严重程度: 低)`);
console.log(`     描述: 今天早上食欲不太好，已创建跟进待办`);
console.log('');
console.log('========================================');
console.log('现在可以启动系统体验这些示例数据：');
console.log('');
console.log('  npm start');
console.log('');
console.log('然后访问: http://localhost:3000');
console.log('========================================');
