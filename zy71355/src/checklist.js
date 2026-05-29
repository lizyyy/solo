const inquirer = require('inquirer');
const chalk = require('chalk');

const CATEGORIES = {
  lens: { name: '镜头', icon: '📷', items: [] },
  lightStand: { name: '灯架', icon: '🎥', items: [] },
  battery: { name: '电池', icon: '🔋', items: [] },
  accessory: { name: '配件', icon: '🔧', items: [] }
};

async function runChecklist(rentalId, expectedItems = []) {
  console.log(chalk.blue.bold('\n=== 器材清点流程 ===\n'));
  
  const checkedItems = [];
  const damages = [];
  
  for (const categoryKey of Object.keys(CATEGORIES)) {
    const category = CATEGORIES[categoryKey];
    console.log(chalk.yellow(`\n--- ${category.icon} ${category.name}清点 ---`));
    
    const categoryExpected = expectedItems.filter(i => i.category === categoryKey);
    
    if (categoryKey === 'battery') {
      const result = await checkBatteries(categoryExpected);
      checkedItems.push(...result.items);
      damages.push(...result.damages);
    } else {
      const result = await checkCategoryItems(categoryKey, category.name, categoryExpected);
      checkedItems.push(...result.items);
      damages.push(...result.damages);
    }
  }
  
  const missingItems = findMissingItems(expectedItems, checkedItems);
  
  return {
    checkedItems,
    damages,
    missingItems,
    completedAt: new Date().toISOString()
  };
}

async function checkCategoryItems(categoryKey, categoryName, expectedItems) {
  const items = [];
  const damages = [];
  let count = 0;
  
  if (expectedItems.length > 0) {
    console.log(chalk.gray(`租借单登记数量: ${expectedItems.length}件`));
    for (const expected of expectedItems) {
      const result = await verifyItem(expected, categoryName);
      items.push(result.item);
      if (result.damage) damages.push(result.damage);
      count++;
    }
  }
  
  const { addMore } = await inquirer.prompt([{
    type: 'confirm',
    name: 'addMore',
    message: `是否还有其他${categoryName}需要登记？`,
    default: false
  }]);
  
  while (addMore) {
    const result = await inputNewItem(categoryKey, categoryName, count + 1);
    items.push(result.item);
    if (result.damage) damages.push(result.damage);
    count++;
    
    const { continue: cont } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continue',
      message: '继续添加？',
      default: false
    }]);
    if (!cont) break;
  }
  
  return { items, damages };
}

async function verifyItem(expectedItem, categoryName) {
  console.log(chalk.cyan(`\n核对: ${expectedItem.name} (编号: ${expectedItem.serialNumber})`));
  
  const { status, hasDamage } = await inquirer.prompt([
    {
      type: 'list',
      name: 'status',
      message: '物品状态:',
      choices: [
        { name: '完好归还', value: 'returned' },
        { name: '有损伤', value: 'damaged' },
        { name: '缺失', value: 'missing' },
        { name: '非本次租借', value: 'not_rented' }
      ]
    },
    {
      type: 'confirm',
      name: 'hasDamage',
      message: '是否需要记录损伤详情？',
      default: false,
      when: (ans) => ans.status === 'damaged'
    }
  ]);
  
  const item = {
    id: expectedItem.id,
    category: expectedItem.category,
    name: expectedItem.name,
    serialNumber: expectedItem.serialNumber,
    status,
    verified: true,
    verifiedAt: new Date().toISOString()
  };
  
  let damage = null;
  if (hasDamage) {
    damage = await inputDamage(expectedItem);
    item.damageId = damage.id;
  }
  
  return { item, damage };
}

async function inputNewItem(categoryKey, categoryName, index) {
  console.log(chalk.cyan(`\n新增${categoryName} #${index}`));
  
  const answers = await inquirer.prompt([
    { type: 'input', name: 'name', message: '名称:', validate: v => v.length > 0 },
    { type: 'input', name: 'serialNumber', message: '器材编号:', validate: v => v.length > 0 },
    {
      type: 'list',
      name: 'status',
      message: '状态:',
      choices: [
        { name: '完好', value: 'good' },
        { name: '有损伤', value: 'damaged' },
        { name: '遗留物品', value: 'found' }
      ]
    },
    {
      type: 'confirm',
      name: 'hasDamage',
      message: '记录损伤？',
      default: false,
      when: (ans) => ans.status === 'damaged'
    }
  ]);
  
  const item = {
    id: `item-${Date.now()}-${index}`,
    category: categoryKey,
    name: answers.name,
    serialNumber: answers.serialNumber,
    status: answers.status,
    verified: false,
    verifiedAt: new Date().toISOString()
  };
  
  let damage = null;
  if (answers.hasDamage) {
    damage = await inputDamage({ serialNumber: answers.serialNumber, name: answers.name });
    item.damageId = damage.id;
  }
  
  return { item, damage };
}

async function checkBatteries(expectedBatteries) {
  const items = [];
  const damages = [];
  
  const { count } = await inquirer.prompt([{
    type: 'input',
    name: 'count',
    message: '实际清点电池数量:',
    default: expectedBatteries.length || 0,
    validate: v => !isNaN(parseInt(v))
  }]);
  
  const actualCount = parseInt(count);
  const expectedCount = expectedBatteries.length;
  
  for (let i = 0; i < actualCount; i++) {
    const { serialNumber, voltage } = await inquirer.prompt([
      { type: 'input', name: 'serialNumber', message: `电池 #${i + 1} 编号:`, default: `BAT-${String(i + 1).padStart(3, '0')}` },
      { type: 'input', name: 'voltage', message: '电压 (V):', default: '未测' }
    ]);
    
    items.push({
      id: `bat-${Date.now()}-${i}`,
      category: 'battery',
      name: '电池',
      serialNumber,
      voltage,
      status: 'checked',
      verifiedAt: new Date().toISOString()
    });
  }
  
  return { items, damages, batterySummary: { expected: expectedCount, actual: actualCount, diff: actualCount - expectedCount } };
}

async function inputDamage(item) {
  console.log(chalk.red('\n=== 损伤记录 ==='));
  
  const damage = await inquirer.prompt([
    { type: 'list', name: 'severity', message: '严重程度:', choices: [
      { name: '轻微 - 划痕', value: 'minor' },
      { name: '中等 - 功能受影响', value: 'medium' },
      { name: '严重 - 无法使用', value: 'severe' }
    ]},
    { type: 'input', name: 'location', message: '损伤部位:' },
    { type: 'input', name: 'description', message: '详细描述:' },
    { type: 'confirm', name: 'hasPhoto', message: '是否已拍摄照片？', default: true },
    { type: 'input', name: 'photoPath', message: '照片路径/编号:', when: (ans) => ans.hasPhoto },
    { type: 'input', name: 'estimatedCost', message: '预估维修费用 (元):', default: '0' }
  ]);
  
  return {
    id: `dmg-${Date.now()}`,
    itemSerialNumber: item.serialNumber,
    itemName: item.name,
    ...damage,
    estimatedCost: parseFloat(damage.estimatedCost) || 0,
    recordedAt: new Date().toISOString()
  };
}

function findMissingItems(expected, checked) {
  const checkedSerials = new Set(checked.map(i => i.serialNumber));
  return expected.filter(e => !checkedSerials.has(e.serialNumber));
}

async function manualCheckSpace() {
  console.log(chalk.magenta('\n=== 人工核对区域 ===\n'));
  console.log(chalk.gray('请在此区域进行人工核对，确认无误后继续...\n'));
  
  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: '人工核对完成，确认清点结果无误？',
    default: false
  }]);
  
  return { confirmed, confirmedAt: new Date().toISOString() };
}

module.exports = {
  runChecklist,
  inputDamage,
  manualCheckSpace,
  CATEGORIES
};
