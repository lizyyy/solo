const { readData, writeData, generateId } = require('./server/utils/dataHandler');

const EQUIPMENT_FILE = 'equipment.json';
const ORDERS_FILE = 'orders.json';

const sampleEquipment = [
  {
    name: '基础露营套装',
    description: '适合2人基础露营需求',
    stock: 5,
    items: [
      { id: generateId(), name: '双人帐篷', quantity: 1, deposit: 300, rentalFee: 50 },
      { id: generateId(), name: '睡袋', quantity: 2, deposit: 100, rentalFee: 20 },
      { id: generateId(), name: '炉头', quantity: 1, deposit: 80, rentalFee: 10 },
      { id: generateId(), name: '防潮垫', quantity: 2, deposit: 50, rentalFee: 5 }
    ]
  },
  {
    name: '豪华露营套装',
    description: '适合3-4人舒适露营',
    stock: 3,
    items: [
      { id: generateId(), name: '家庭帐篷', quantity: 1, deposit: 500, rentalFee: 100 },
      { id: generateId(), name: '睡袋', quantity: 4, deposit: 100, rentalFee: 20 },
      { id: generateId(), name: '炉头', quantity: 2, deposit: 80, rentalFee: 10 },
      { id: generateId(), name: '防潮垫', quantity: 4, deposit: 50, rentalFee: 5 },
      { id: generateId(), name: '折叠桌椅', quantity: 1, deposit: 200, rentalFee: 30 }
    ]
  },
  {
    name: '轻量化徒步套装',
    description: '适合单人徒步露营',
    stock: 8,
    items: [
      { id: generateId(), name: '单人帐篷', quantity: 1, deposit: 400, rentalFee: 60 },
      { id: generateId(), name: '羽绒睡袋', quantity: 1, deposit: 300, rentalFee: 40 },
      { id: generateId(), name: '轻量化炉头', quantity: 1, deposit: 120, rentalFee: 15 }
    ]
  }
];

const initSampleData = () => {
  const equipment = sampleEquipment.map(equip => ({
    id: generateId(),
    name: equip.name,
    description: equip.description,
    items: equip.items,
    totalDeposit: equip.items.reduce((sum, item) => sum + item.deposit * item.quantity, 0),
    totalRentalFee: equip.items.reduce((sum, item) => sum + item.rentalFee * item.quantity, 0),
    stock: equip.stock,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  
  writeData(EQUIPMENT_FILE, equipment);
  writeData(ORDERS_FILE, []);
  
  console.log('✅ 样例数据初始化完成！');
  console.log('\n📋 添加的装备套装：');
  equipment.forEach(equip => {
    console.log(`  - ${equip.name}: 押金${equip.totalDeposit}元, 日租${equip.totalRentalFee}元, 库存${equip.stock}套`);
    console.log(`    包含：${equip.items.map(i => `${i.name}×${i.quantity}`).join(', ')}`);
  });
  console.log('\n🚀 现在可以启动服务器：npm start');
};

initSampleData();
