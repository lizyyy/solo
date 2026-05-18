const db = require('../src/models/database');

const sampleData = [
  {
    reschedule_no: 'RS202405123456001',
    customer_name: '张三',
    customer_phone: '13800138001',
    original_shot_date: '2024-06-15',
    new_shot_date: '2024-06-20',
    original_route: '三亚湾经典路线',
    new_route: '亚龙湾豪华路线',
    scenic_spot: '三亚亚龙湾',
    store: '三亚旗舰店',
    person_in_charge: '李经理',
    reschedule_reason: '客户档期调整',
    status: 'pending',
    reschedule_fee: 500,
    remarks: '客户要求升级套餐',
    created_at: '2024-05-10T10:30:00.000Z',
    updated_at: '2024-05-10T10:30:00.000Z'
  },
  {
    reschedule_no: 'RS202405123456002',
    customer_name: '李四',
    customer_phone: '13800138002',
    original_shot_date: '2024-06-18',
    new_shot_date: '2024-07-01',
    original_route: '丽江古城人文路线',
    new_route: '玉龙雪山全景路线',
    scenic_spot: '丽江玉龙雪山',
    store: '丽江分店',
    person_in_charge: '王主管',
    reschedule_reason: '景区临时封闭，天气原因',
    status: 'confirmed',
    reschedule_fee: 0,
    remarks: '景区通知6月18日封闭，已协调客户改期',
    created_at: '2024-05-11T14:20:00.000Z',
    updated_at: '2024-05-11T15:00:00.000Z'
  },
  {
    reschedule_no: 'RS202405123456003',
    customer_name: '王五',
    customer_phone: '13800138003',
    original_shot_date: '2024-05-20',
    new_shot_date: '2024-05-25',
    original_route: '鼓浪屿文艺路线',
    new_route: '曾厝垵小清新路线',
    scenic_spot: '厦门鼓浪屿',
    store: '厦门分店',
    person_in_charge: '陈店长',
    reschedule_reason: '客户突发急事',
    status: 'completed',
    reschedule_fee: 200,
    remarks: '拍摄已完成，费用已结清',
    created_at: '2024-05-15T09:00:00.000Z',
    updated_at: '2024-05-26T18:00:00.000Z'
  },
  {
    reschedule_no: 'RS202405123456004',
    customer_name: '赵六',
    customer_phone: '13800138004',
    original_shot_date: '2024-07-10',
    new_shot_date: '2024-07-15',
    original_route: '九寨沟自然风光',
    new_route: '黄龙景区路线',
    scenic_spot: '四川九寨沟',
    store: '成都旗舰店',
    person_in_charge: '刘经理',
    reschedule_reason: '景区临时封闭，维护通知',
    status: 'pending',
    reschedule_fee: 0,
    remarks: '景区维护通知，涉及3组客户，批量改期中',
    created_at: '2024-05-12T11:45:00.000Z',
    updated_at: '2024-05-12T11:45:00.000Z'
  },
  {
    reschedule_no: 'RS202405123456005',
    customer_name: '孙七',
    customer_phone: '13800138005',
    original_shot_date: '2024-06-05',
    new_shot_date: '2024-06-10',
    original_route: '西湖断桥路线',
    new_route: '灵隐寺禅意路线',
    scenic_spot: '杭州西湖',
    store: '杭州分店',
    person_in_charge: '周主管',
    reschedule_reason: '天气预告有暴雨',
    status: 'cancelled',
    reschedule_fee: 100,
    remarks: '客户取消改期，选择退款',
    created_at: '2024-05-08T16:30:00.000Z',
    updated_at: '2024-05-09T10:00:00.000Z'
  }
];

async function seedData() {
  console.log('开始导入样例数据...');
  
  const placeholders = sampleData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)').join(',');
  const values = sampleData.flatMap(d => [
    d.reschedule_no, d.customer_name, d.customer_phone, d.original_shot_date,
    d.new_shot_date, d.original_route, d.new_route, d.scenic_spot, d.store,
    d.person_in_charge, d.reschedule_reason, d.status, d.reschedule_fee,
    d.remarks, d.created_at, d.updated_at
  ]);

  const sql = `INSERT OR IGNORE INTO reschedules (
    reschedule_no, customer_name, customer_phone, original_shot_date,
    new_shot_date, original_route, new_route, scenic_spot, store,
    person_in_charge, reschedule_reason, status, reschedule_fee,
    remarks, created_at, updated_at, is_reversed, reversed_from
  ) VALUES ${placeholders}`;

  try {
    await db.run(sql, values);
    console.log(`成功导入 ${sampleData.length} 条样例数据`);
    console.log('其中 RS202405123456003 为已完成记录，可用于验证冲正功能');
    console.log('其中 RS202405123456002、RS202405123456004 为景区封闭影响的记录');
  } catch (error) {
    console.error('导入失败:', error.message);
  } finally {
    await db.close();
  }
}

seedData();