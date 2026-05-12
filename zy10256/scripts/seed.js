const Storage = require('../src/storage');

const seedData = () => {
  console.log('正在导入种子数据...\n');

  Storage.reset();

  const persons = [
    { name: '张三', employeeId: 'EMP001', phone: '13800138001', role: '后厨管理员' },
    { name: '李四', employeeId: 'EMP002', phone: '13800138002', role: '厨师长' },
    { name: '王五', employeeId: 'EMP003', phone: '13800138003', role: '质检员' }
  ];
  persons.forEach(p => Storage.create('responsiblePersons', { ...p, isActive: true }));
  console.log('✓ 责任人数据导入完成');

  const dishes = [
    { name: '红烧肉', category: '热菜', description: '带皮五花肉烧制' },
    { name: '清炒时蔬', category: '素菜', description: '时令蔬菜' },
    { name: '西红柿鸡蛋汤', category: '汤类', description: '经典汤品' },
    { name: '清蒸鱼', category: '热菜', description: '鲜活草鱼' },
    { name: '宫保鸡丁', category: '热菜', description: '川菜经典' },
    { name: '米饭', category: '主食', description: '东北大米' }
  ];
  dishes.forEach(d => Storage.create('dishes', { ...d, isActive: true }));
  console.log('✓ 菜品数据导入完成');

  const boxes = [];
  for (let i = 1; i <= 20; i++) {
    const box = Storage.create('sampleBoxes', {
      boxNumber: `BOX-${String(i).padStart(3, '0')}`,
      location: `冷藏柜A-${Math.ceil(i / 5)}`,
      capacity: '500g',
      status: 'available'
    });
    boxes.push(box);
  }
  console.log('✓ 留样盒数据导入完成');

  const today = new Date().toISOString().split('T')[0];
  const allDishes = Storage.getAll('dishes');
  const dishIds = allDishes.map(d => d.id);

  const lunch = Storage.create('meals', {
    mealType: 'lunch',
    mealDate: today,
    dishIds: dishIds.slice(0, 4),
    status: 'prepared',
    openedAt: null
  });

  const dinner = Storage.create('meals', {
    mealType: 'dinner',
    mealDate: today,
    dishIds: dishIds.slice(2, 6),
    status: 'prepared',
    openedAt: null
  });
  console.log('✓ 餐次数据导入完成');

  console.log('\n种子数据导入成功！');
  console.log(`  - 责任人: ${persons.length} 人`);
  console.log(`  - 菜品: ${dishes.length} 道`);
  console.log(`  - 留样盒: ${boxes.length} 个`);
  console.log(`  - 今日餐次: 2 个`);
  console.log('\n运行 npm run demo 查看完整流程演示');
};

seedData();
