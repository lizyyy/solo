const { Command } = require('commander');
const { parseAllFiles } = require('./parser');
const { analyzeTables, generateStatistics } = require('./analyzer');
const { printSummary, exportJSON, exportMarkdown } = require('./reporter');
const path = require('path');

const program = new Command();

program
  .name('db-comment')
  .description('数据库表注释检查CLI工具 - 检查DDL文件中的注释缺失和矛盾')
  .version('1.0.0')
  .argument('<paths...>', 'DDL文件或目录路径')
  .option('--json <path>', '导出JSON报告到指定路径')
  .option('--md <path>', '导出Markdown报告到指定路径')
  .option('--output-dir <dir>', '报告输出目录（默认: 当前目录)')
  .option('--no-summary', '不显示终端摘要')
  .action(async (paths, options) => {
    try {
      const outputDir = options.outputDir || process.cwd();
      
      console.log(`🔍 正在分析 ${paths.length} 个路径...`);
      
      const { tables, badLines } = parseAllFiles(paths);
      
      console.log(`✓ 解析完成: 发现 ${tables.length} 个表, ${badLines.length} 行异常`);
      
      const analysis = analyzeTables(tables);
      const stats = generateStatistics(tables, analysis, badLines);
      
      if (options.summary !== false) {
        printSummary(stats);
      }
      
      if (options.json) {
        const jsonPath = path.isAbsolute(options.json) ? options.json : path.join(outputDir, options.json);
        exportJSON(stats, jsonPath);
      }
      
      if (options.md) {
        const mdPath = path.isAbsolute(options.md) ? options.md : path.join(outputDir, options.md);
        exportMarkdown(stats, mdPath);
      }
      
      if (!options.json && !options.md && options.summary !== false) {
        console.log('💡 提示: 使用 --json 或 --md 选项导出详细报告');
      }
      
      process.exit(stats.summary.hasIssues ? 1 : 0);
    } catch (error) {
      console.error('❌ 执行出错:', error.message);
      process.exit(2);
    }
  });

program.parse();
