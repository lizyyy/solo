const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Papa = require('papaparse');
const {
  TYPES,
  createDeliveryRecord,
  createReturnRecord,
  createRefundRecord,
  createHistoryRecord
} = require('../models');
const storage = require('../storage');
const validator = require('../validator');

const typeMap = {
  delivery: {
    type: TYPES.DELIVERY,
    label: '配送单',
    factory: createDeliveryRecord
  },
  return: {
    type: TYPES.RETURN,
    label: '回收单',
    factory: createReturnRecord
  },
  refund: {
    type: TYPES.REFUND,
    label: '退款申请',
    factory: createRefundRecord
  },
  history: {
    type: TYPES.HISTORY,
    label: '历史欠桶',
    factory: createHistoryRecord
  }
};

module.exports = {
  command: 'import <type> <file>',
  aliases: ['i'],
  describe: '导入数据：delivery(配送单) / return(回收单) / refund(退款申请) / history(历史欠桶)',
  builder: {
    type: {
      describe: '数据类型',
      choices: Object.keys(typeMap),
      type: 'string'
    },
    file: {
      describe: 'CSV 或 JSON 文件路径',
      type: 'string'
    },
    skipDuplicateCheck: {
      alias: 's',
      describe: '跳过重复检查',
      type: 'boolean',
      default: false
    },
    overwrite: {
      alias: 'o',
      describe: '覆盖已存在的 staging 数据',
      type: 'boolean',
      default: false
    }
  },
  handler: function(argv) {
    const { type, file, skipDuplicateCheck, overwrite } = argv;
    
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`错误: 文件不存在 ${file}`));
      process.exit(1);
    }
    
    const config = typeMap[type];
    console.log(chalk.blue(`\n🔄 正在导入 ${config.label} 数据...`));
    console.log(chalk.gray(`   源文件: ${file}`));
    
    const records = readFile(file, config.type);
    console.log(chalk.gray(`   读取到 ${records.length} 条原始记录`));
    
    const processedRecords = records.map(config.factory);
    
    const basicErrors = validator.checkBasicValidity(processedRecords, config.type);
    if (basicErrors && basicErrors.length > 0) {
      console.error(chalk.red(`\n❌ 基础校验失败，发现 ${basicErrors.length} 个问题：`));
      basicErrors.slice(0, 10).forEach(err => {
        console.error(chalk.yellow(`   - 第${err.index}条 [${err.id}] ${err.customer}: ${err.issues.join(', ')}`));
      });
      if (basicErrors.length > 10) {
        console.error(chalk.yellow(`   ... 还有 ${basicErrors.length - 10} 个问题未显示`));
      }
      console.error(chalk.red('\n请修正数据后重新导入'));
      process.exit(1);
    }
    
    if (!skipDuplicateCheck) {
      const dupCheck = validator.checkDuplicates(processedRecords, config.type);
      if (dupCheck) {
        console.error(chalk.red(`\n❌ 发现重复记录：${dupCheck.message}`));
        dupCheck.records.slice(0, 10).forEach(r => {
          console.error(chalk.yellow(`   - ${r.id}: ${r.customer}`));
        });
        if (dupCheck.records.length > 10) {
          console.error(chalk.yellow(`   ... 还有 ${dupCheck.records.length - 10} 条重复`));
        }
        console.error(chalk.red('\n重复导入不会重复计算，请使用 --skipDuplicateCheck 强制导入（重复记录会被忽略）'));
        process.exit(1);
      }
    }
    
    let existing = storage.getStagingData(config.type);
    const existingIds = new Set(existing.map(r => r.id));
    const newRecords = processedRecords.filter(r => !existingIds.has(r.id));
    const skipped = processedRecords.length - newRecords.length;
    
    let finalRecords;
    if (overwrite) {
      finalRecords = newRecords;
      console.log(chalk.yellow(`   覆盖模式：已清除原有 staging 数据`));
    } else {
      finalRecords = [...existing, ...newRecords];
    }
    
    storage.saveStagingData(config.type, finalRecords);
    
    console.log(chalk.green(`\n✅ 导入成功！`));
    console.log(chalk.green(`   新增: ${newRecords.length} 条`));
    if (skipped > 0) {
      console.log(chalk.yellow(`   跳过重复: ${skipped} 条`));
    }
    console.log(chalk.gray(`   总计 staging: ${finalRecords.length} 条`));
    console.log(chalk.gray(`\n💡 提示: 运行 'water-deposit check' 进行完整性检查，确认无误后运行 'water-deposit confirm' 确认入账`));
  }
};

function readFile(filePath, type) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.json') {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }
  
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = Papa.parse(content, { header: true, skipEmptyLines: true });
    if (result.errors.length > 0) {
      console.error(chalk.yellow(`CSV 解析警告: ${result.errors.length} 个问题`));
    }
    return result.data;
  }
  
  throw new Error(`不支持的文件格式: ${ext}`);
}
