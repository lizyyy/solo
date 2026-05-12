const db = require('../src/database/init');
const { v4: uuidv4 } = require('uuid');
const service = require('../src/services/registrationService');

const residents = [
  { id: 'RES-001', name: '张小明', id_card: '110101201605201234', birth_date: '2016-05-20', gender: '男', phone: null, address: '幸福社区1号楼1单元101' },
  { id: 'RES-002', name: '李明', id_card: '110101201711052345', birth_date: '2017-11-05', gender: '男', phone: null, address: '幸福社区1号楼1单元101' },
  { id: 'RES-003', name: '王志强', id_card: '110101201507203456', birth_date: '2015-07-20', gender: '男', phone: null, address: '幸福社区2号楼2单元202' },
  { id: 'RES-004', name: '刘小花', id_card: '110101201702284567', birth_date: '2017-02-28', gender: '女', phone: null, address: '幸福社区3号楼1单元301' },
  { id: 'RES-005', name: '陈静', id_card: '110101199012125678', birth_date: '1990-12-12', gender: '女', phone: '13800138005', address: '幸福社区4号楼3单元401' },
  { id: 'RES-006', name: '赵晓梅', id_card: '110101201604256789', birth_date: '2016-04-25', gender: '女', phone: null, address: '幸福社区5号楼2单元502' },
  { id: 'RES-007', name: '孙丽', id_card: '110101201506157890', birth_date: '2015-06-15', gender: '女', phone: null, address: '幸福社区6号楼1单元601' },
  { id: 'RES-008', name: '赵晓军', id_card: '110101201810128901', birth_date: '2018-10-12', gender: '男', phone: null, address: '幸福社区5号楼2单元502' },
  { id: 'RES-009', name: '张伟', id_card: '110101198501151234', birth_date: '1985-01-15', gender: '男', phone: '13800138001', address: '幸福社区1号楼1单元101' },
  { id: 'RES-010', name: '李娜', id_card: '110101198703202345', birth_date: '1987-03-20', gender: '女', phone: '13800138002', address: '幸福社区1号楼1单元101' },
];

const familyMembers = [
  { id: 'FM-001', resident_id: 'RES-001', name: '张小明', relation: '儿子', birth_date: '2016-05-20', gender: '男', phone: null },
  { id: 'FM-002', resident_id: 'RES-001', name: '张小美', relation: '女儿', birth_date: '2018-08-10', gender: '女', phone: null },
  { id: 'FM-003', resident_id: 'RES-002', name: '李明', relation: '儿子', birth_date: '2017-11-05', gender: '男', phone: null },
  { id: 'FM-004', resident_id: 'RES-002', name: '李华', relation: '女儿', birth_date: '2019-03-15', gender: '女', phone: null },
  { id: 'FM-005', resident_id: 'RES-003', name: '王志强', relation: '儿子', birth_date: '2015-07-20', gender: '男', phone: null },
  { id: 'FM-006', resident_id: 'RES-004', name: '刘小花', relation: '女儿', birth_date: '2017-02-28', gender: '女', phone: null },
  { id: 'FM-007', resident_id: 'RES-004', name: '刘小强', relation: '儿子', birth_date: '2019-09-10', gender: '男', phone: null },
  { id: 'FM-008', resident_id: 'RES-005', name: '陈浩', relation: '儿子', birth_date: '2020-01-01', gender: '男', phone: null },
  { id: 'FM-009', resident_id: 'RES-006', name: '赵晓梅', relation: '女儿', birth_date: '2016-04-25', gender: '女', phone: null },
  { id: 'FM-010', resident_id: 'RES-006', name: '赵晓军', relation: '儿子', birth_date: '2018-10-12', gender: '男', phone: null },
  { id: 'FM-011', resident_id: 'RES-006', name: '赵爷爷', relation: '父亲', birth_date: '1950-05-05', gender: '男', phone: null },
  { id: 'FM-012', resident_id: 'RES-007', name: '孙妈妈', relation: '母亲', birth_date: '1985-08-20', gender: '女', phone: '13800138007' },
];

const activities = [
  {
    id: 'ACT-PARENTCHILD-001',
    name: '亲子手工制作活动',
    description: '社区亲子手工制作活动，适合6-12岁儿童参加，每户最多3人，制作DIY风筝和环保手工艺品',
    start_time: '2026-06-01 09:00:00',
    end_time: '2026-06-01 11:30:00',
    location: '社区活动中心多功能厅',
    max_participants: 10,
    min_age: 6,
    max_age: 12,
    max_per_family: 3,
    status: 'active',
    created_by: '管理员'
  },
  {
    id: 'ACT-SENIOR-001',
    name: '老年人健康讲座',
    description: '邀请社区医院专家讲解老年人常见疾病预防和健康养生知识',
    start_time: '2026-06-15 14:00:00',
    end_time: '2026-06-15 16:00:00',
    location: '社区活动中心会议室',
    max_participants: 30,
    min_age: 55,
    max_age: null,
    max_per_family: 5,
    status: 'active',
    created_by: '管理员'
  },
  {
    id: 'ACT-SUMMER-001',
    name: '暑期夏令营报名',
    description: '社区暑期青少年夏令营，包含户外活动、安全教育、兴趣培养等内容',
    start_time: '2026-07-15 08:30:00',
    end_time: '2026-07-20 17:00:00',
    location: '社区活动中心及郊外营地',
    max_participants: 20,
    min_age: 8,
    max_age: 16,
    max_per_family: 2,
    status: 'draft',
    created_by: '管理员'
  }
];

async function seed() {
  await db.init();
  
  console.log('开始导入种子数据...\n');
  
  db.prepare('DELETE FROM audit_logs').run();
  db.prepare('DELETE FROM idempotency_keys').run();
  db.prepare('DELETE FROM registrations').run();
  db.prepare('DELETE FROM waitlist').run();
  db.prepare('DELETE FROM family_members').run();
  db.prepare('DELETE FROM residents').run();
  db.prepare('DELETE FROM activities').run();
  
  for (const resident of residents) {
    db.prepare(`
      INSERT INTO residents (id, name, id_card, birth_date, gender, phone, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(resident.id, resident.name, resident.id_card, resident.birth_date, resident.gender, resident.phone, resident.address);
    console.log(`✓ 居民档案: ${resident.name} (${resident.id})`);
  }
  
  for (const member of familyMembers) {
    db.prepare(`
      INSERT INTO family_members (id, resident_id, name, relation, birth_date, gender, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(member.id, member.resident_id, member.name, member.relation, member.birth_date, member.gender, member.phone);
    const residentName = residents.find(r => r.id === member.resident_id)?.name;
    console.log(`✓ 家庭成员: ${residentName} → ${member.name} (${member.relation})`);
  }
  
  for (const activity of activities) {
    db.prepare(`
      INSERT INTO activities (id, name, description, start_time, end_time, location, max_participants, min_age, max_age, max_per_family, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(activity.id, activity.name, activity.description, activity.start_time, activity.end_time, activity.location,
            activity.max_participants, activity.min_age, activity.max_age, activity.max_per_family, activity.status, activity.created_by);
    console.log(`✓ 活动创建: ${activity.name} (${activity.id})`);
    console.log(`  - 时间: ${activity.start_time} ~ ${activity.end_time || '待定'}`);
    console.log(`  - 名额: ${activity.max_participants}人`);
    console.log(`  - 年龄: ${activity.min_age || '不限'} ~ ${activity.max_age || '不限'}岁`);
    console.log(`  - 每户限: ${activity.max_per_family}人`);
    console.log(`  - 状态: ${activity.status}`);
  }
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('种子数据导入完成！');
  console.log('═══════════════════════════════════════════════\n');
  
  console.log('居民统计:');
  const residentCount = db.prepare('SELECT COUNT(*) as count FROM residents').get().count;
  const familyCount = db.prepare('SELECT COUNT(*) as count FROM family_members').get().count;
  console.log(`  - 主居民档案: ${residentCount} 人`);
  console.log(`  - 家庭成员: ${familyCount} 人`);
  console.log(`  - 总计可报名人员: ${residentCount + familyCount} 人\n`);
  
  console.log('活动统计:');
  const activityCount = db.prepare('SELECT COUNT(*) as count FROM activities').get().count;
  const activeCount = db.prepare('SELECT COUNT(*) as count FROM activities WHERE status = ?').get('active').count;
  console.log(`  - 活动总数: ${activityCount} 个`);
  console.log(`  - 开放报名: ${activeCount} 个\n`);
}

seed().catch(err => {
  console.error('导入种子数据失败:', err);
  process.exit(1);
});
