import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { orderService } from '../services/orderService';
import { schedulingService } from '../services/schedulingService';
import { CakeFlavor, CakeSize, OrderStatus, OrderUrgency } from '../types';

function initOvens(): void {
  const ovens = [
    {
      id: uuidv4(),
      ovenNumber: 'OVEN-001',
      name: '一号烘焙烤箱（热风循环）',
      capacity: 3,
      maxTemperature: 250,
      status: 'active' as const
    },
    {
      id: uuidv4(),
      ovenNumber: 'OVEN-002',
      name: '二号烘焙烤箱（层式）',
      capacity: 4,
      maxTemperature: 280,
      status: 'active' as const
    },
    {
      id: uuidv4(),
      ovenNumber: 'OVEN-003',
      name: '三号烘焙烤箱（维护中）',
      capacity: 2,
      maxTemperature: 220,
      status: 'maintenance' as const
    }
  ];

  ovens.forEach(oven => store.addOven(oven));
  console.log(`已初始化 ${ovens.length} 台烤箱`);
}

function initSampleOrders(): void {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const ordersData = [
    {
      customerName: '张三',
      customerPhone: '13800138001',
      deliveryAddress: '北京市朝阳区建国路88号SOHO现代城A座1501',
      deliveryTime: `${tomorrow} 14:00`,
      cakeName: '经典黑森林',
      cakeFlavor: CakeFlavor.BLACK_FOREST,
      cakeSize: CakeSize.SIZE_8,
      cakeWeight: 1.2,
      layers: 3,
      specialRequirements: '不要樱桃装饰，改用巧克力片',
      urgency: OrderUrgency.NORMAL,
      bakingDuration: 50,
      coolingDuration: 40
    },
    {
      customerName: '李四',
      customerPhone: '13800138002',
      deliveryAddress: '上海市浦东新区陆家嘴环路1000号恒生银行大厦28楼',
      deliveryTime: `${tomorrow} 10:00`,
      cakeName: '草莓奶油蛋糕',
      cakeFlavor: CakeFlavor.STRAWBERRY,
      cakeSize: CakeSize.SIZE_6,
      cakeWeight: 0.8,
      layers: 2,
      specialRequirements: '低糖配方，草莓要新鲜',
      urgency: OrderUrgency.URGENT,
      bakingDuration: 40,
      coolingDuration: 30
    },
    {
      customerName: '王五',
      customerPhone: '13800138003',
      deliveryAddress: '广州市天河区珠江新城华夏路30号富力盈通大厦42层',
      deliveryTime: `${today} 18:00`,
      cakeName: '抹茶红豆慕斯',
      cakeFlavor: CakeFlavor.MATCHA,
      cakeSize: CakeSize.SIZE_10,
      cakeWeight: 1.8,
      layers: 4,
      specialRequirements: '生日蛋糕，请在蛋糕上写"生日快乐"，需要蜡烛和刀叉',
      urgency: OrderUrgency.SUPER_URGENT,
      bakingDuration: 55,
      coolingDuration: 60
    },
    {
      customerName: '赵六',
      customerPhone: '13800138004',
      deliveryAddress: '深圳市南山区科技园南区深南大道9996号松日鼎盛大厦19楼',
      deliveryTime: `${tomorrow} 15:30`,
      cakeName: '芒果千层',
      cakeFlavor: CakeFlavor.MANGO,
      cakeSize: CakeSize.SIZE_8,
      cakeWeight: 1.0,
      layers: 15,
      specialRequirements: '芒果需用台农芒，奶油用动物奶油',
      urgency: OrderUrgency.NORMAL,
      bakingDuration: 35,
      coolingDuration: 120
    },
    {
      customerName: '孙七',
      customerPhone: '13800138005',
      deliveryAddress: '杭州市西湖区文三路478号华星科技大厦A座1205',
      deliveryTime: `${tomorrow} 11:00`,
      cakeName: '提拉米苏',
      cakeFlavor: CakeFlavor.TIRAMISU,
      cakeSize: CakeSize.SIZE_6,
      cakeWeight: 0.7,
      layers: 5,
      specialRequirements: '咖啡味稍重，撒可可粉',
      urgency: OrderUrgency.URGENT,
      bakingDuration: 45,
      coolingDuration: 180
    }
  ];

  const operators = ['张师傅', '李师傅', '王主管', '赵领班'];
  
  ordersData.forEach((data, index) => {
    const order = orderService.createOrder(data, operators[index % operators.length]);
    
    if (index === 0) {
      orderService.updateStatus(order.id, OrderStatus.PENDING_SCHEDULE, operators[0], '信息确认完毕，待排产');
      const oven = store.getOvens()[0];
      const scheduleResult = schedulingService['executeScheduling'](order, oven.id, tomorrow, '08:00-10:00');
      if (scheduleResult.success) {
        console.log(`订单 ${order.orderNo} 已排产`);
      }
    }
    
    if (index === 1) {
      orderService.updateStatus(order.id, OrderStatus.PENDING_SCHEDULE, operators[1], '急单确认');
    }
  });

  console.log(`已初始化 ${ordersData.length} 个样例订单`);
}

function main(): void {
  console.log('开始初始化烘焙工坊蛋糕急单排产系统数据...\n');
  
  store.clearAll();
  console.log('已清空原有数据\n');
  
  initOvens();
  console.log('');
  initSampleOrders();
  
  console.log('\n=== 初始化完成 ===');
  console.log('烤箱列表:');
  store.getOvens().forEach(o => {
    console.log(`  ${o.ovenNumber} - ${o.name} - 容量: ${o.capacity}`);
  });
  
  console.log('\n订单列表:');
  store.getOrders().forEach(o => {
    console.log(`  ${o.orderNo} - ${o.cakeName} - ${o.urgency} - ${o.status}`);
    if (o.scheduledOvenId) {
      const oven = store.getOvenById(o.scheduledOvenId);
      console.log(`    排产: ${oven?.ovenNumber} - ${o.scheduledDate} ${o.scheduledTimeSlot}`);
    }
  });
}

main();