const chalk = require('chalk');
const storage = require('../storage');
const { TYPES } = require('../models');
const validator = require('../validator');

module.exports = {
  command: 'confirm',
  aliases: ['co'],
  describe: '将 staging 数据确认入账到 confirmed',
  builder: {
    type: {
      alias: 't',
      describe: '只确认特定类型',
      type: 'string',
      choices: ['delivery', 'return', 'refund', 'history', 'all'],
      default: 'all'
    },
    force: {
      alias: 'f',
      describe: '跳过检查强制确认（不推荐）',
      type: 'boolean',
      default: false
    },
    yes: {
      alias: 'y',
      describe: '自动确认无需交互',
      type: 'boolean',
      default: false
    }
  },
  handler: function(argv) {
    const { type, force, yes } = argv;
    
    if (!force) {
      const issues = validator.runAllChecks();
      if (issues.length > 0) {
        console.error(chalk.red(`\n❌ 发现 ${issues.length} 个异常，无法确认入账`));
        console.error(chalk.gray('💡 请先运行 \'water-deposit check\' 查看详情，或使用 --force 强制确认'));
        process.exit(1);
      }
    } else {
      console.log(chalk.yellow('⚠️  警告: 跳过异常检查，请确保数据正确！'));
    }
    
    const types = type === 'all' 
      ? [TYPES.DELIVERY, TYPES.RETURN, TYPES.REFUND, TYPES.HISTORY]
      : [type];
    
    const labels = {
      [TYPES.DELIVERY]: '配送单',
      [TYPES.RETURN]: '回收单',
      [TYPES.REFUND]: '退款申请',
      [TYPES.HISTORY]: '历史欠桶'
    };
    
    let totalMoved = 0;
    const details = [];
    
    types.forEach(t => {
      const staging = storage.getStagingData(t);
      const confirmed = storage.getConfirmedData(t);
      
      const existingIds = new Set(confirmed.map(r => r.id));
      const toMove = staging.filter(r => !existingIds.has(r.id));
      const duplicates = staging.length - toMove.length;
      
      if (toMove.length > 0) {
        const updatedConfirmed = [...confirmed, ...toMove];
        storage.saveConfirmedData(t, updatedConfirmed);
        
        const remaining = staging.filter(r => !toMove.includes(r));
        storage.saveStagingData(t, remaining);
      }
      
      totalMoved += toMove.length;
      details.push({
        type: labels[t],
        moved: toMove.length,
        skipped: duplicates
      });
    });
    
    console.log(chalk.green(`\n✅ 确认入账完成！`));
    console.log(chalk.green(`   共计确认: ${totalMoved} 条记录`));
    
    details.forEach(d => {
      if (d.moved > 0 || d.skipped > 0) {
        let msg = `   ${d.type}: ${d.moved} 条入账`;
        if (d.skipped > 0) {
          msg += ` (${d.skipped} 条重复已跳过)`;
        }
        console.log(chalk.gray(msg));
      }
    });
    
    console.log(chalk.gray('\n💡 提示: 运行 \'water-deposit report\' 查看对账报表'));
  }
};
