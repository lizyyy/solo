const path = require('path');
const storage = require('../services/storage');

module.exports = {
  name: 'export',
  description: '导出复盘数据为JSON',
  execute(args) {
    if (args.length < 1) {
      console.error('使用方法: canteen-review export <date> [outputPath]');
      process.exit(1);
    }
    
    const date = args[0];
    const defaultOutput = path.join(process.cwd(), `export_${date}.json`);
    const outputPath = args[1] ? path.resolve(process.cwd(), args[1]) : defaultOutput;
    
    console.log(`\n=== 导出数据: ${date} ===\n`);
    
    try {
      const exportedPath = storage.exportData(date, outputPath);
      
      console.log('✅ 导出成功!');
      console.log(`   输出路径: ${exportedPath}`);
      console.log();
    } catch (error) {
      console.error(`导出失败: ${error.message}`);
      console.log();
      process.exit(1);
    }
  }
};
