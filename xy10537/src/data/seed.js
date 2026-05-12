const service = require('../services/schedulingService');

function createDemoData() {
  console.log('=== 开始创建样例数据 ===\n');

  console.log('--- 1. 创建技能标签 ---');
  const skills = [
    { name: '日常保洁', category: 'cleaning', description: '家庭日常清洁服务' },
    { name: '深度保洁', category: 'cleaning', description: '深度清洁，包括厨房、卫生间死角' },
    { name: '做饭', category: 'cooking', description: '家常菜制作' },
    { name: '月嫂', category: 'babycare', description: '新生儿和产妇护理' },
    { name: '育儿', category: 'babycare', description: '婴幼儿照料' },
    { name: '老人护理', category: 'eldercare', description: '老年人日常生活照料' }
  ];

  const skillIds = {};
  skills.forEach(skill => {
    const result = service.createSkill(skill, 'system');
    skillIds[skill.name] = result.data.id;
    console.log(`  ✓ 创建技能: ${skill.name} (ID: ${result.data.id})`);
  });

  console.log('\n--- 2. 创建阿姨档案 ---');
  const nannies = [
    {
      name: '张阿姨',
      phone: '13800000001',
      skills: ['日常保洁', '深度保洁', '做饭'],
      workArea: '朝阳',
      dailyCapacity: 3,
      rating: 4.8,
      preferredNannyOf: ['王女士', '李女士']
    },
    {
      name: '李阿姨',
      phone: '13800000002',
      skills: ['日常保洁', '做饭', '育儿'],
      workArea: '海淀',
      dailyCapacity: 2,
      rating: 4.6
    },
    {
      name: '王阿姨',
      phone: '13800000003',
      skills: ['日常保洁', '深度保洁', '老人护理'],
      workArea: '朝阳',
      dailyCapacity: 2,
      rating: 4.9
    },
    {
      name: '赵阿姨',
      phone: '13800000004',
      skills: ['育儿', '做饭'],
      workArea: '东城',
      dailyCapacity: 1,
      rating: 5.0
    },
    {
      name: '陈阿姨',
      phone: '13800000005',
      skills: ['日常保洁'],
      workArea: '西城',
      dailyCapacity: 3,
      rating: 4.3
    }
  ];

  const nannyIds = {};
  nannies.forEach(nanny => {
    const result = service.createNanny(nanny, 'system');
    nannyIds[nanny.name] = result.data.id;
    console.log(`  ✓ 创建阿姨: ${nanny.name} (ID: ${result.data.id})`);
  });

  console.log('\n--- 3. 创建客户订单 ---');
  const orders = [
    {
      customerName: '王女士',
      customerPhone: '13900000001',
      customerArea: '朝阳',
      customerLocation: { lat: 39.9, lng: 116.4 },
      serviceType: '日常保洁',
      requiredSkills: ['日常保洁'],
      preferredNanny: nannyIds['张阿姨'],
      startTime: '09:00',
      endTime: '11:00',
      serviceDate: '2026-05-13',
      estimatedDuration: 120,
      notes: '每周三固定保洁'
    },
    {
      customerName: '李先生',
      customerPhone: '13900000002',
      customerArea: '海淀',
      customerLocation: { lat: 39.95, lng: 116.3 },
      serviceType: '月嫂服务',
      requiredSkills: ['月嫂'],
      startTime: '08:00',
      endTime: '18:00',
      serviceDate: '2026-05-13',
      estimatedDuration: 600,
      notes: '需要月嫂照顾新生儿'
    },
    {
      customerName: '赵女士',
      customerPhone: '13900000003',
      customerArea: '朝阳',
      customerLocation: { lat: 39.92, lng: 116.42 },
      serviceType: '深度保洁',
      requiredSkills: ['深度保洁'],
      startTime: '14:00',
      endTime: '18:00',
      serviceDate: '2026-05-13',
      estimatedDuration: 240,
      notes: '厨房和卫生间需要重点清洁'
    },
    {
      customerName: '孙先生',
      customerPhone: '13900000004',
      customerArea: '朝阳',
      customerLocation: { lat: 39.93, lng: 116.41 },
      serviceType: '老人护理',
      requiredSkills: ['老人护理'],
      startTime: '08:00',
      endTime: '10:00',
      serviceDate: '2026-05-12',
      estimatedDuration: 120,
      notes: '照顾80岁老人'
    },
    {
      customerName: '周女士',
      customerPhone: '13900000005',
      customerArea: '西城',
      customerLocation: { lat: 39.91, lng: 116.35 },
      serviceType: '育儿',
      requiredSkills: ['育儿', '做饭'],
      startTime: '09:00',
      endTime: '17:00',
      serviceDate: '2026-05-14',
      estimatedDuration: 480,
      notes: '照顾2岁宝宝，需要做饭'
    }
  ];

  const orderIds = {};
  orders.forEach(order => {
    const result = service.createOrder(order, 'system');
    orderIds[order.customerName] = result.data.id;
    console.log(`  ✓ 创建订单: ${order.customerName} - ${order.serviceType} (ID: ${result.data.id})`);
  });

  console.log('\n=== 样例数据创建完成 ===');
  console.log('\n--- 数据统计 ---');
  console.log(`  技能数量: ${service.getAllSkills().data.length}`);
  console.log(`  阿姨数量: ${service.getAllNannies().data.length}`);
  console.log(`  订单数量: ${service.getAllOrders().data.length}`);
  console.log('\n');

  return { skillIds, nannyIds, orderIds };
}

if (require.main === module) {
  createDemoData();
}

module.exports = { createDemoData };
