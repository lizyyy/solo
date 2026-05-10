const chalk = require('chalk');
const storage = require('../storage');
const { TYPES } = require('../models');

module.exports = {
  command: 'fix <type> <id> [field] [value]',
  aliases: ['f'],
  describe: '人工修正 staging 数据：支持修改字段、删除记录',
  builder: {
    type: {
      describe: '数据类型',
      choices: ['delivery', 'return', 'refund', 'history'],
      type: 'string'
    },
    id: {
      describe: '记录ID（订单号/回收单号/退款单号等）',
      type: 'string'
    },
    field: {
      describe: '要修改的字段名（留空查看详情）',
      type: 'string'
    },
    value: {
      describe: '新值（删除时用 --delete）',
      type: 'string'
    },
    delete: {
      alias: 'D',
      describe: '删除该记录',
      type: 'boolean',
      default: false
    },
    list: {
      alias: 'l',
      describe: '列出该类型所有 staging 记录',
      type: 'boolean',
      default: false
    }
  },
  handler: function(argv) {
    const { type, id, field, value, delete: shouldDelete, list } = argv;
    
    const typeMap = {
      delivery: TYPES.DELIVERY,
      return: TYPES.RETURN,
      refund: TYPES.REFUND,
      history: TYPES.HISTORY
    };
    
    const actualType = typeMap[type];
    
    if (list) {
      listRecords(actualType);
      return;
    }
    
    const records = storage.getStagingData(actualType);
    const record = records.find(r => r.id === id);
    
    if (!record) {
      console.error(chalk.red(`❌ 未找到记录: ${id}`));
      console.error(chalk.gray(`💡 提示: 使用 'water-deposit fix ${type} ${id} --list' 查看所有记录`));
      process.exit(1);
    }
    
    if (shouldDelete) {
      const filtered = records.filter(r => r.id !== id);
      storage.saveStagingData(actualType, filtered);
      console.log(chalk.green(`✅ 已删除记录: ${id}`));
      return;
    }
    
    if (!field) {
      console.log(chalk.cyan(`\n📋 记录详情 [${id}]:\n`));
      Object.entries(record).forEach(([k, v]) => {
        console.log(chalk.gray(`   ${k}: `) + chalk.white(`${v}`));
      });
      console.log(chalk.gray(`\n💡 示例: water-deposit fix ${type} ${id} customer \"新客户名\"`));
      return;
    }
    
    if (!(field in record)) {
      console.error(chalk.red(`❌ 字段不存在: ${field}`));
      console.error(chalk.gray(`   可用字段: ${Object.keys(record).join(', ')}`));
      process.exit(1);
    }
    
    const oldValue = record[field];
    record[field] = parseValue(field, value);
    storage.saveStagingData(actualType, records);
    
    console.log(chalk.green(`✅ 已更新记录 ${id}:`));
    console.log(chalk.gray(`   ${field}: ${oldValue} → ${record[field]}`));
  }
};

function listRecords(type) {
  const records = storage.getStagingData(type);
  
  if (records.length === 0) {
    console.log(chalk.gray('暂无 staging 数据'));
    return;
  }
  
  console.log(chalk.cyan(`\n📋 共 ${records.length} 条 staging 记录:\n`));
  
  records.forEach((r, idx) => {
    const keyInfo = r.customer ? ` ${r.customer}` : '';
    const bucketInfo = r.bucketCount ? ` (${r.bucketCount}桶)` : '';
    console.log(chalk.gray(`   ${idx + 1}. [${r.id}]${keyInfo}${bucketInfo}`));
  });
  
  console.log(chalk.gray('\n💡 使用详情: water-deposit fix <type> <id>'));
}

function parseValue(field, value) {
  if (['bucketCount', 'owedBuckets'].includes(field)) {
    return parseInt(value, 10);
  }
  if (['totalDeposit', 'refundAmount', 'depositPerBucket', 'owedDeposit'].includes(field)) {
    return parseFloat(value);
  }
  return value;
}
