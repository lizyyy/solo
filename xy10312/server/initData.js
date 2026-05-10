const { writeData, DATA_DIR } = require('./data');
const config = require('./config');
const fs = require('fs');

console.log('正在初始化数据目录:', DATA_DIR);

function getNextSaturday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -1 : 6 - day;
  const sat = new Date(now);
  sat.setDate(sat.getDate() + (diff === 0 ? 7 : diff));
  return sat.toISOString().split('T')[0];
}

function getNextSunday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sun = new Date(now);
  sun.setDate(sun.getDate() + (diff === 0 ? 7 : diff));
  return sun.toISOString().split('T')[0];
}

const nextSat = getNextSaturday();
const nextSun = getNextSunday();
const prevSat = (() => {
  const d = new Date(nextSat);
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
})();
const prevSun = (() => {
  const d = new Date(nextSun);
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
})();

const materials = {
  flour: { name: '低筋面粉', unit: 'g', stock: 5000, minStock: 2000, costPerUnit: 0.02 },
  eggs: { name: '鸡蛋', unit: '个', stock: 30, minStock: 20, costPerUnit: 1.5 },
  sugar: { name: '白砂糖', unit: 'g', stock: 3000, minStock: 1500, costPerUnit: 0.01 },
  butter: { name: '无盐黄油', unit: 'g', stock: 2000, minStock: 1000, costPerUnit: 0.08 },
  milk: { name: '牛奶', unit: 'ml', stock: 2000, minStock: 1000, costPerUnit: 0.015 },
  cocoa: { name: '可可粉', unit: 'g', stock: 300, minStock: 200, costPerUnit: 0.15 },
  matcha: { name: '抹茶粉', unit: 'g', stock: 200, minStock: 150, costPerUnit: 0.25 },
  redBean: { name: '红豆', unit: 'g', stock: 400, minStock: 300, costPerUnit: 0.03 },
  strawberry: { name: '新鲜草莓', unit: 'g', stock: 800, minStock: 500, costPerUnit: 0.05 },
  mango: { name: '新鲜芒果', unit: 'g', stock: 600, minStock: 400, costPerUnit: 0.08 },
  cheese: { name: '奶油芝士', unit: 'g', stock: 1000, minStock: 500, costPerUnit: 0.12 },
  cream: { name: '淡奶油', unit: 'ml', stock: 1500, minStock: 1000, costPerUnit: 0.06 }
};

const orders = [
  {
    id: 'ORD2024001',
    customerName: '张女士',
    phone: '13800138001',
    flavor: 'vanilla',
    size: '8inch',
    pickupDate: prevSat,
    pickupTime: '14:00',
    message: '妈妈生日，祝生日快乐',
    totalPrice: 192,
    deposit: 100,
    depositPaid: true,
    status: 'completed',
    capacityUsed: 1,
    createdAt: (() => { const d = new Date(prevSat); d.setDate(d.getDate() - 3); return d.toISOString(); })(),
    history: []
  },
  {
    id: 'ORD2024002',
    customerName: '李先生',
    phone: '13800138002',
    flavor: 'chocolate',
    size: '6inch',
    pickupDate: nextSat,
    pickupTime: '11:00',
    message: '公司下午茶',
    totalPrice: 158,
    deposit: 80,
    depositPaid: true,
    status: 'confirmed',
    capacityUsed: 1,
    createdAt: new Date().toISOString(),
    history: []
  },
  {
    id: 'ORD2024003',
    customerName: '王小姐',
    phone: '13800138003',
    flavor: 'strawberry',
    size: '10inch',
    pickupDate: nextSat,
    pickupTime: '15:00',
    message: '宝宝满月',
    totalPrice: 356,
    deposit: 180,
    depositPaid: true,
    status: 'confirmed',
    capacityUsed: 2,
    createdAt: new Date().toISOString(),
    history: []
  },
  {
    id: 'ORD2024004',
    customerName: '赵先生',
    phone: '13800138004',
    flavor: 'matcha',
    size: '8inch',
    pickupDate: nextSun,
    pickupTime: '16:00',
    message: '',
    totalPrice: 252,
    deposit: 0,
    depositPaid: false,
    status: 'pending',
    capacityUsed: 1.5,
    createdAt: new Date().toISOString(),
    history: []
  },
  {
    id: 'ORD2024005',
    customerName: '陈女士',
    phone: '13800138005',
    flavor: 'mango',
    size: '12inch',
    pickupDate: nextSun,
    pickupTime: '12:00',
    message: '婚礼甜品台用',
    totalPrice: 526.4,
    deposit: 300,
    depositPaid: true,
    status: 'reschedule_pending',
    capacityUsed: 2.8,
    originalPickupDate: nextSat,
    createdAt: new Date().toISOString(),
    rescheduleRequested: {
      fromDate: nextSat,
      toDate: nextSun,
      reason: '婚礼改期',
      requestTime: new Date().toISOString()
    },
    history: [
      {
        action: 'create',
        date: nextSat,
        time: '12:00',
        timestamp: new Date().toISOString()
      },
      {
        action: 'reschedule_request',
        fromDate: nextSat,
        toDate: nextSun,
        reason: '婚礼改期',
        timestamp: new Date().toISOString()
      }
    ]
  }
];

const dailyCapacity = {
  [prevSat]: { total: config.DAILY_CAPACITY, used: 1 },
  [prevSun]: { total: config.DAILY_CAPACITY, used: 0 },
  [nextSat]: { total: config.DAILY_CAPACITY, used: 3 },
  [nextSun]: { total: config.DAILY_CAPACITY, used: 4.3 }
};

const materialUsage = {
  [nextSat]: {
    flour: 720, eggs: 11, sugar: 380, butter: 220, cocoa: 50, strawberry: 400, cream: 300
  },
  [nextSun]: {
    flour: 504, eggs: 13.6, sugar: 420, butter: 188, matcha: 45, mango: 700, cream: 774, redBean: 150
  }
};

console.log('正在写入订单数据...');
writeData('orders.json', orders);

console.log('正在写入材料库存...');
writeData('materials.json', materials);

console.log('正在写入日产能数据...');
writeData('dailyCapacity.json', dailyCapacity);

console.log('正在写入材料用量数据...');
writeData('materialUsage.json', materialUsage);

console.log('正在写入配置...');
writeData('config.json', config);

console.log('\n✅ 初始化完成！');
console.log('\n示例订单说明：');
console.log('  ORD2024001 - 已完成订单（上周末）');
console.log('  ORD2024002 - 正常已确认订单（本周六11点）');
console.log('  ORD2024003 - 正常已确认订单（本周六15点）');
console.log('  ORD2024004 - 待付定金订单（本周日）');
console.log('  ORD2024005 - 改期待审核订单（从周六改到周日）');
console.log('\n请运行 npm install && npm start 启动系统');
