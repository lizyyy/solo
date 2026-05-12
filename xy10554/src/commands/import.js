const fs = require('fs');
const Store = require('../utils/store');
const { ContentRecord } = require('../models/content');
const chalk = require('chalk');

function importCommand(filePath, options) {
  console.log(chalk.blue('\n=== 导入内容发布记录 ===\n'));
  
  const store = new Store();
  
  if (!fs.existsSync(filePath)) {
    console.log(chalk.red(`错误: 文件不存在: ${filePath}`));
    return { success: false, error: `File not found: ${filePath}` };
  }

  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(rawData);
    
    const contents = Array.isArray(jsonData) ? jsonData : [jsonData];
    let imported = 0;
    let errors = [];
    
    contents.forEach((data, index) => {
      try {
        const content = new ContentRecord(data);
        store.addContent(content);
        imported++;
        console.log(chalk.green(`  ✓ 导入 #${index + 1}: ${content.title}`));
      } catch (e) {
        errors.push({ index, message: e.message });
        console.log(chalk.red(`  ✗ 导入 #${index + 1}: 失败 - ${e.message}`));
      }
    });
    
    console.log(chalk.cyan(`\n=== 导入结果: 成功 ${imported} 条`));
    if (errors.length > 0) {
      console.log(chalk.yellow(`警告: ${errors.length} 条导入失败`));
    }
    
    return {
      success: errors.length === 0,
      imported,
      failed: errors.length
    };
  } catch (e) {
    console.log(chalk.red(`导入失败: ${e.message}`));
    return { success: false, error: e.message };
  }
}

module.exports = importCommand;
