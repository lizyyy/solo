const { table } = require('table');
const chalk = require('chalk');
const dataStore = require('./dataStore');
const businessLogic = require('./businessLogic');

function formatTable(headers, rows, options = {}) {
  const config = {
    header: {
      alignment: 'center',
      content: options.title || ''
    },
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼'
    }
  };
  
  const coloredHeaders = headers.map(h => chalk.bold.cyan(h));
  const data = [coloredHeaders, ...rows];
  
  return table(data, config);
}

function generateMaterialTable() {
  const materials = dataStore.getMaterials();
  const inventory = dataStore.getInventory();
  
  if (materials.length === 0) {
    return chalk.yellow('没有物料台账记录');
  }
  
  const headers = ['物料代码', '物料名称', '单位', '初始库存', '当前库存'];
  const rows = materials.map(m => [
    m.code,
    m.name,
    m.unit,
    m.initialStock,
    inventory[m.code] || m.initialStock
  ]);
  
  return formatTable(headers, rows, { title: '📋 物料台账' });
}

function generateActivitiesTable() {
  const activities = dataStore.getActivities();
  
  if (activities.length === 0) {
    return chalk.yellow('没有活动记录');
  }
  
  const headers = ['活动ID', '活动名称', '开始日期', '结束日期', '地点'];
  const rows = activities.map(a => [
    a.id,
    a.name,
    a.startDate,
    a.endDate,
    a.location || '-'
  ]);
  
  return formatTable(headers, rows, { title: '📅 活动列表' });
}

function generateActivityReport(activityId) {
  const activity = dataStore.getActivityById(activityId);
  if (!activity) {
    return chalk.red(`活动 ${activityId} 不存在`);
  }
  
  const leaders = dataStore.getLeadersByActivity(activityId);
  const returns = dataStore.getReturnsByActivity(activityId);
  const losses = dataStore.getLossesByActivity(activityId);
  const damages = dataStore.getDamagesByActivity(activityId);
  const consumptions = dataStore.getConsumptionsByActivity(activityId);
  const balance = businessLogic.calculateActivityBalance(activityId);
  const issues = businessLogic.checkActivityCompletion(activityId);
  
  let report = '';
  
  report += chalk.bold.blue(`\n════════════════════════════════════════════════\n`);
  report += chalk.bold.blue(`  活动物料报告 - ${activity.name} (${activity.id})\n`);
  report += chalk.bold.blue(`════════════════════════════════════════════════\n\n`);
  
  report += chalk.cyan('活动信息:\n');
  report += `  活动名称: ${activity.name}\n`;
  report += `  活动ID: ${activity.id}\n`;
  report += `  开始日期: ${activity.startDate}\n`;
  report += `  结束日期: ${activity.endDate}\n`;
  if (activity.location) {
    report += `  地点: ${activity.location}\n`;
  }
  report += '\n';
  
  if (leaders.length > 0) {
    const headers = ['物料代码', '物料名称', '领用数量', '单位'];
    const rows = leaders.map(l => [l.materialCode, l.materialName, l.quantity, l.unit]);
    report += formatTable(headers, rows, { title: '📦 领用物料' });
    report += '\n';
  }
  
  if (returns.length > 0) {
    const headers = ['物料代码', '物料名称', '归还数量', '单位', '备注'];
    const rows = returns.map(r => [r.materialCode, r.materialName, r.quantity, r.unit, r.remark || '-']);
    report += formatTable(headers, rows, { title: '✅ 归还物料' });
    report += '\n';
  }
  
  if (losses.length > 0) {
    const headers = ['物料代码', '物料名称', '丢失数量', '单位', '原因', '备注'];
    const rows = losses.map(l => [l.materialCode, l.materialName, l.quantity, l.unit, l.reason, l.remark || '-']);
    report += formatTable(headers, rows, { title: '❌ 丢失物料' });
    report += '\n';
  }
  
  if (damages.length > 0) {
    const headers = ['物料代码', '物料名称', '报损数量', '单位', '原因', '备注'];
    const rows = damages.map(d => [d.materialCode, d.materialName, d.quantity, d.unit, d.reason, d.remark || '-']);
    report += formatTable(headers, rows, { title: '⚠️ 报损物料' });
    report += '\n';
  }
  
  if (consumptions.length > 0) {
    const headers = ['物料代码', '物料名称', '消耗数量', '单位', '消耗说明'];
    const rows = consumptions.map(c => [c.materialCode, c.materialName, c.quantity, c.unit, c.description]);
    report += formatTable(headers, rows, { title: '🎁 礼品消耗' });
    report += '\n';
  }
  
  if (balance.length > 0) {
    const headers = ['物料代码', '物料名称', '借出', '归还', '丢失', '报损', '消耗', '差额', '单位'];
    const rows = balance.map(b => {
      const balanceStr = b.balance === 0 ? chalk.green(b.balance) : 
                        b.balance > 0 ? chalk.yellow(b.balance) : chalk.red(b.balance);
      return [
        b.materialCode,
        b.materialName,
        b.borrowed,
        b.returned,
        b.lost,
        b.damaged,
        b.consumed,
        balanceStr,
        b.unit
      ];
    });
    report += formatTable(headers, rows, { title: '📊 物料平衡表' });
    report += '\n';
  }
  
  if (issues.length > 0) {
    report += chalk.bold.red('⚠️  存在的问题:\n');
    for (const issue of issues) {
      const icon = issue.type === 'over_returned' ? '🔴' : '🟡';
      report += `  ${icon} ${issue.message}\n`;
    }
    report += '\n';
  } else if (balance.length > 0) {
    report += chalk.bold.green('✅ 所有物料已处理完毕\n\n');
  }
  
  return report;
}

function generatePurchaseReport() {
  const result = businessLogic.generatePurchaseSuggestions();
  
  let report = '';
  report += chalk.bold.blue(`\n════════════════════════════════════════════════\n`);
  report += chalk.bold.blue(`  补采购建议报告\n`);
  report += chalk.bold.blue(`════════════════════════════════════════════════\n\n`);
  
  if (!result.hasSuggestions) {
    report += chalk.green('✅ 当前库存充足，无需补采购\n\n');
    return report;
  }
  
  const headers = ['物料代码', '物料名称', '当前库存', '需求数量', '需采购', '单位', '影响活动', '活动日期'];
  const rows = result.suggestions.map(s => [
    s.materialCode,
    s.materialName,
    s.currentStock,
    s.requiredForActivity,
    chalk.red(s.needToPurchase),
    s.unit,
    s.affectedActivityName,
    s.affectedActivityDate
  ]);
  
  report += formatTable(headers, rows, { title: '🛒 补采购清单' });
  report += '\n';
  
  report += chalk.yellow('说明:\n');
  report += '  - 以上物料库存不足，将影响指定活动的开展\n';
  report += '  - 建议及时采购，确保活动顺利进行\n\n';
  
  return report;
}

function generateInventoryReport() {
  const materials = dataStore.getMaterials();
  const inventory = dataStore.getInventory();
  
  let report = '';
  report += chalk.bold.blue(`\n════════════════════════════════════════════════\n`);
  report += chalk.bold.blue(`  当前库存报告\n`);
  report += chalk.bold.blue(`════════════════════════════════════════════════\n\n`);
  
  if (materials.length === 0) {
    report += chalk.yellow('没有物料记录\n\n');
    return report;
  }
  
  const headers = ['物料代码', '物料名称', '单位', '初始库存', '当前库存', '库存状态'];
  const rows = materials.map(m => {
    const current = inventory[m.code] || m.initialStock;
    let status;
    if (current === 0) {
      status = chalk.red('缺货');
    } else if (current < m.initialStock * 0.3) {
      status = chalk.yellow('库存低');
    } else {
      status = chalk.green('充足');
    }
    return [m.code, m.name, m.unit, m.initialStock, current, status];
  });
  
  report += formatTable(headers, rows, { title: '📦 库存清单' });
  report += '\n';
  
  return report;
}

module.exports = {
  generateMaterialTable,
  generateActivitiesTable,
  generateActivityReport,
  generatePurchaseReport,
  generateInventoryReport,
  formatTable
};
