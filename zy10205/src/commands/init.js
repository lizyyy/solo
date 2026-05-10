const storage = require('../storage/file');
const chalk = require('chalk');

const defaultConfig = {
  initialized: true,
  initializedAt: new Date().toISOString(),
  version: '1.0.0',
  festival: {
    name: '情人节',
    date: '2026-02-14'
  }
};

const defaultDeliverySlots = [
  {
    slotId: 'morning-1',
    name: '早班 09:00-10:00',
    startTime: '09:00',
    endTime: '10:00',
    isPromised: true
  },
  {
    slotId: 'morning-2',
    name: '早班 10:00-11:00',
    startTime: '10:00',
    endTime: '11:00',
    isPromised: true
  },
  {
    slotId: 'morning-3',
    name: '早班 11:00-12:00',
    startTime: '11:00',
    endTime: '12:00',
    isPromised: true
  },
  {
    slotId: 'afternoon-1',
    name: '午班 14:00-15:00',
    startTime: '14:00',
    endTime: '15:00',
    isPromised: true
  },
  {
    slotId: 'afternoon-2',
    name: '午班 15:00-16:00',
    startTime: '15:00',
    endTime: '16:00',
    isPromised: true
  },
  {
    slotId: 'afternoon-3',
    name: '午班 16:00-17:00',
    startTime: '16:00',
    endTime: '17:00',
    isPromised: true
  },
  {
    slotId: 'evening-1',
    name: '晚班 18:00-19:00',
    startTime: '18:00',
    endTime: '19:00',
    isPromised: true
  },
  {
    slotId: 'evening-2',
    name: '晚班 19:00-20:00',
    startTime: '19:00',
    endTime: '20:00',
    isPromised: false,
    note: '情人节特殊时段'
  }
];

const defaultBouquetSpecs = [
  {
    specId: 'romantic-rose-11',
    name: '浪漫红玫瑰 11枝',
    description: '11枝红玫瑰搭配满天星和尤加利叶',
    price: 399,
    flowers: [
      { name: '红玫瑰', quantity: 11, price: 20 },
      { name: '满天星', quantity: 3, price: 8 },
      { name: '尤加利叶', quantity: 5, price: 5 }
    ]
  },
  {
    specId: 'eternal-love-19',
    name: '永恒爱恋 19枝',
    description: '19枝粉玫瑰搭配白桔梗',
    price: 599,
    flowers: [
      { name: '粉玫瑰', quantity: 19, price: 22 },
      { name: '白桔梗', quantity: 5, price: 12 },
      { name: '尤加利叶', quantity: 8, price: 5 }
    ]
  },
  {
    specId: 'premium-33',
    name: '豪华玫瑰 33枝',
    description: '33枝顶级红玫瑰',
    price: 999,
    flowers: [
      { name: '红玫瑰', quantity: 33, price: 25 },
      { name: '满天星', quantity: 5, price: 8 },
      { name: '尤加利叶', quantity: 10, price: 5 }
    ]
  }
];

const defaultReplacements = [
  {
    originalFlower: '红玫瑰',
    options: [
      { name: '粉玫瑰', priority: 1, price: 22, note: '同级别替换' },
      { name: '香槟玫瑰', priority: 2, price: 24, note: '高级替换，需加收费用' }
    ]
  },
  {
    originalFlower: '粉玫瑰',
    options: [
      { name: '红玫瑰', priority: 1, price: 20, note: '同级别替换' },
      { name: '白玫瑰', priority: 2, price: 21, note: '同级别替换' }
    ]
  },
  {
    originalFlower: '白桔梗',
    options: [
      { name: '洋桔梗', priority: 1, price: 13, note: '同级别替换' }
    ]
  }
];

const defaultInventory = [
  { flowerName: '红玫瑰', quantity: 100, unit: '枝' },
  { flowerName: '粉玫瑰', quantity: 80, unit: '枝' },
  { flowerName: '白玫瑰', quantity: 50, unit: '枝' },
  { flowerName: '香槟玫瑰', quantity: 30, unit: '枝' },
  { flowerName: '满天星', quantity: 200, unit: '枝' },
  { flowerName: '尤加利叶', quantity: 150, unit: '枝' },
  { flowerName: '白桔梗', quantity: 60, unit: '枝' },
  { flowerName: '洋桔梗', quantity: 40, unit: '枝' }
];

function init(options = {}) {
  const force = options.force || false;
  
  if (storage.readJSON(storage.getConfigPath(), null) && !force) {
    console.log(chalk.yellow('⚠️  工作区已初始化，使用 --force 参数强制重新初始化'));
    return false;
  }
  
  storage.ensureDir(storage.DATA_DIR);
  
  storage.writeJSON(storage.getConfigPath(), defaultConfig);
  storage.writeJSON(storage.getDeliverySlotsPath(), defaultDeliverySlots);
  storage.writeJSON(storage.getBouquetSpecsPath(), defaultBouquetSpecs);
  storage.writeJSON(storage.getReplacementsPath(), defaultReplacements);
  storage.writeJSON(storage.getInventoryPath(), defaultInventory);
  storage.writeJSON(storage.getOrdersPath(), []);
  storage.writeJSON(storage.getCardsPath(), []);
  storage.writeJSON(storage.getHistoryPath(), []);
  storage.writeJSON(storage.getConfirmationsPath(), []);
  
  console.log(chalk.green('✅ 花店节日预订单配货系统初始化成功！'));
  console.log('');
  console.log(chalk.bold('📦 默认配置已加载：'));
  console.log(`   配送时段: ${defaultDeliverySlots.length} 个`);
  console.log(`   花束规格: ${defaultBouquetSpecs.length} 个`);
  console.log(`   花材库存: ${defaultInventory.length} 种`);
  console.log(`   可替换花材: ${defaultReplacements.length} 种`);
  console.log('');
  console.log(chalk.blue('💡 可以修改 data/ 目录下的 JSON 文件来自定义配置'));
  
  return true;
}

module.exports = {
  init,
  defaultConfig,
  defaultDeliverySlots,
  defaultBouquetSpecs,
  defaultReplacements,
  defaultInventory
};
