const path = require('path');
const helpers = require('../utils/helpers');
const storage = require('../services/storage');
const validator = require('../services/validator');

module.exports = {
  name: 'import',
  description: '导入数据文件',
  execute(args) {
    if (args.length < 1) {
      console.error('使用方法: canteen-review import <file>');
      process.exit(1);
    }
    
    const filePath = path.resolve(process.cwd(), args[0]);
    
    if (!filePath.endsWith('.json')) {
      console.error('错误: 只支持 JSON 格式的文件');
      process.exit(1);
    }
    
    const data = helpers.readJSON(filePath);
    if (!data) {
      console.error(`错误: 无法读取文件 ${filePath}`);
      process.exit(1);
    }
    
    const date = data.date;
    if (!date) {
      console.error('错误: 数据文件缺少 date 字段');
      process.exit(1);
    }
    
    const duplicateCheck = storage.checkDuplicateImport(date);
    
    if (duplicateCheck.hasConfirmed) {
      console.error(`\n错误: 日期 ${date} 已存在确认记录，不能重复导入。`);
      console.error('如果需要修改，请先删除确认记录后重试。\n');
      process.exit(1);
    }
    
    console.log(`\n=== 导入数据: ${date} ===\n`);
    
    const validation = validator.validateAll(data.data || data);
    
    if (!validation.isValid) {
      console.error('数据验证失败:');
      validation.errors.forEach(err => console.error(`  ❌ ${err}`));
      console.log();
      process.exit(1);
    }
    
    const result = storage.savePending(date, data.data || data);
    
    console.log(`✅ 数据导入成功 (${result.status})`);
    console.log(`   保存路径: ${storage.getPendingPath(date)}\n`);
    
    if (validation.hasWarnings) {
      console.log('⚠️  警告信息:');
      validation.warnings.forEach(w => {
        console.log(`   ${w.message}`);
      });
      console.log();
    }
    
    console.log('下一步操作:');
    console.log(`  canteen-review check ${date}`);
    console.log();
  }
};
