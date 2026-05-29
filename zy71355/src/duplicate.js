const inquirer = require('inquirer');
const chalk = require('chalk');
const crypto = require('crypto');

function generateFileHash(content) {
  return crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
}

async function checkDuplicateReturn(rentalId, existingReturns, importData = null) {
  const matchingReturns = existingReturns.filter(r => r.rentalId === rentalId);
  
  if (matchingReturns.length === 0) {
    return { isDuplicate: false };
  }
  
  console.log(chalk.yellow.bold('\n⚠️  检测到重复归还记录!\n'));
  console.log(chalk.yellow(`租借单号 ${rentalId} 已有 ${matchingReturns.length} 条归还记录:\n`));
  
  matchingReturns.forEach((r, i) => {
    console.log(`  ${i + 1}. 归还单号: ${r.id}`);
    console.log(`     创建时间: ${new Date(r.createdAt).toLocaleString('zh-CN')}`);
    console.log(`     状态: ${r.status || '进行中'}\n`);
  });
  
  const fileHash = importData ? generateFileHash(importData) : null;
  
  return {
    isDuplicate: true,
    matchingReturns,
    fileHash,
    rentalId
  };
}

async function handleDuplicateResolution(duplicateInfo, conflictMode = 'prompt') {
  if (!duplicateInfo.isDuplicate) {
    return { action: 'create_new' };
  }
  
  switch (conflictMode) {
    case 'skip':
      console.log(chalk.blue('\n⏭️  已跳过重复归还记录\n'));
      return { action: 'skip', existing: duplicateInfo.matchingReturns[0] };
      
    case 'overwrite':
      console.log(chalk.red('\n🔄  将覆盖现有归还记录\n'));
      return { action: 'overwrite', existing: duplicateInfo.matchingReturns[0] };
      
    case 'append':
      console.log(chalk.green('\n➕  将追加到现有归还记录\n'));
      return { action: 'append', existing: duplicateInfo.matchingReturns[0] };
      
    default:
      return await promptResolution(duplicateInfo);
  }
}

async function promptResolution(duplicateInfo) {
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: '请选择处理方式:',
    choices: [
      { name: '跳过 - 不创建新记录', value: 'skip' },
      { name: '覆盖 - 覆盖最新的记录', value: 'overwrite' },
      { name: '追加 - 创建新记录(允许重复)', value: 'append' },
      { name: '查看详情后决定', value: 'view_detail' }
    ]
  }]);
  
  if (action === 'view_detail') {
    return { action: 'view_detail', existing: duplicateInfo.matchingReturns[0] };
  }
  
  return { action, existing: duplicateInfo.matchingReturns[0] };
}

async function handleImportConflict(existingData, newData, mode) {
  switch (mode) {
    case 'skip':
      return { action: 'skipped', data: existingData };
      
    case 'overwrite':
      return { action: 'overwritten', data: { ...existingData, ...newData, id: existingData.id } };
      
    case 'append':
      const merged = {
        ...existingData,
        checkedItems: [
          ...(existingData.checkedItems || []),
          ...(newData.checkedItems || []).map(item => ({
            ...item,
            appended: true,
            appendedAt: new Date().toISOString()
          }))
        ],
        damages: [
          ...(existingData.damages || []),
          ...(newData.damages || []).map(d => ({
            ...d,
            appended: true,
            appendedAt: new Date().toISOString()
          }))
        ],
        importHistory: [
          ...(existingData.importHistory || []),
          {
            timestamp: new Date().toISOString(),
            action: 'append',
            itemsAdded: (newData.checkedItems || []).length,
            damagesAdded: (newData.damages || []).length
          }
        ]
      };
      return { action: 'appended', data: merged };
      
    default:
      return { action: 'prompt', data: existingData };
  }
}

module.exports = {
  generateFileHash,
  checkDuplicateReturn,
  handleDuplicateResolution,
  handleImportConflict
};
