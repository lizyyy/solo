const storage = require('../storage/file');
const chalk = require('chalk');

function showHistory(options = {}) {
  const history = storage.readJSON(storage.getHistoryPath(), []);
  const limit = options.limit ? Number(options.limit) : 20;
  const action = options.action;
  
  let filteredHistory = [...history];
  
  if (action) {
    filteredHistory = filteredHistory.filter(h => h.action === action);
  }
  
  filteredHistory = filteredHistory.slice(-limit).reverse();
  
  if (filteredHistory.length === 0) {
    console.log(chalk.yellow('⚠️  暂无历史记录'));
    return [];
  }
  
  console.log('');
  console.log(chalk.bold.blue('════════════════════════════════════════════'));
  console.log(chalk.bold.blue('              操作历史记录'));
  console.log(chalk.bold.blue('════════════════════════════════════════════'));
  console.log('');
  
  const actionNames = {
    'import': '导入订单',
    'import_bouquet_specs': '导入花束规格',
    'import_inventory': '导入库存',
    'import_replacements': '导入替换花材',
    'import_delivery_slots': '导入配送时段',
    'import_cards': '导入卡片',
    'confirm_replacement': '确认替换',
    'confirm_price_sync': '确认价格',
    'export': '导出'
  };
  
  filteredHistory.forEach((record, idx) => {
    const timestamp = new Date(record.timestamp).toLocaleString('zh-CN');
    const actionName = actionNames[record.action] || record.action;
    const details = JSON.stringify(record.details);
    
    console.log(chalk.bold(`${idx + 1}. [${timestamp}]`));
    console.log(`   操作: ${actionName}`);
    console.log(`   详情: ${details}`);
    console.log('');
  });
  
  return filteredHistory;
}

function showConfirmations(orderId) {
  const deliveryManager = require('../core/delivery-manager');
  const confirmations = orderId 
    ? deliveryManager.getOrderConfirmations(orderId)
    : deliveryManager.getConfirmations();
  
  if (confirmations.length === 0) {
    console.log(chalk.yellow('⚠️  暂无确认记录'));
    return [];
  }
  
  console.log('');
  console.log(chalk.bold.green('════════════════════════════════════════════'));
  console.log(chalk.bold.green('              确认记录'));
  console.log(chalk.bold.green('════════════════════════════════════════════'));
  console.log('');
  
  confirmations.forEach((conf, idx) => {
    const timestamp = new Date(conf.confirmedAt).toLocaleString('zh-CN');
    const typeNames = {
      'replacement': '花材替换',
      'price_sync': '价格同步'
    };
    
    console.log(chalk.bold(`${idx + 1}. 订单 ${conf.orderId}`));
    console.log(`   类型: ${typeNames[conf.confirmationType] || conf.confirmationType}`);
    console.log(`   确认人: ${conf.confirmedBy || '系统'}`);
    console.log(`   时间: ${timestamp}`);
    
    if (conf.replacements && conf.replacements.length > 0) {
      console.log('   替换详情:');
      conf.replacements.forEach(r => {
        console.log(`     ${r.originalFlower} (${r.quantity}枝) → ${r.replacementFlower}`);
      });
    }
    
    if (conf.newPrice !== undefined) {
      console.log(`   新价格: ${conf.newPrice} 元`);
    }
    
    console.log('');
  });
  
  return confirmations;
}

module.exports = {
  showHistory,
  showConfirmations
};
