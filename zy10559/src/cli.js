#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const { createParser } = require('./parser');
const { QueryAnalyzer } = require('./analyzer');
const { ConsoleOutput, JsonOutput, MarkdownOutput } = require('./output');

program
  .name('sql-fingerprint')
  .description('SQL 慢查询指纹分析工具')
  .version('1.0.0');

program
  .command('analyze', { isDefault: true })
  .description('分析慢查询日志（默认命令）')
  .argument('<file>', '慢查询日志文件路径')
  .option('-f, --format <format>', '输入格式: mysql-slow, simple', 'mysql-slow')
  .option('-o, --output <output>', '输出格式: console, json, markdown, all', 'console')
  .option('-j, --json-output <path>', 'JSON 输出文件路径')
  .option('-m, --md-output <path>', 'Markdown 输出文件路径')
  .option('-t, --top <n>', '显示 Top N 慢查询指纹', '10')
  .option('-s, --sort-by <field>', '排序字段: totalTime, count, avgTime', 'totalTime')
  .option('--title <title>', 'Markdown 报告标题', 'SQL 慢查询指纹分析报告')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file);
      console.log(`正在分析: ${filePath}`);
      console.log();

      const parser = createParser(options.format);
      const parseResult = await parser.parseFile(filePath);

      console.log(`解析完成: ${parseResult.entries.length} 条查询, ${parseResult.errors.length} 个异常`);
      console.log();

      const analyzer = new QueryAnalyzer({
        topN: parseInt(options.top, 10),
        sortBy: options.sortBy
      });

      const report = analyzer.analyze(parseResult.entries);

      const outputType = options.output;

      if (outputType === 'console' || outputType === 'all') {
        const consoleOutput = new ConsoleOutput();
        console.log(consoleOutput.render(report, parseResult.errors));
      }

      if (outputType === 'json' || outputType === 'all' || options.jsonOutput) {
        const jsonOutput = new JsonOutput();
        const jsonPath = options.jsonOutput || 
          (outputType === 'json' || outputType === 'all')
          ? path.basename(file, path.extname(file)) + '-analysis.json'
          : null;
        
        if (jsonPath) {
          const resolvedPath = path.resolve(jsonPath);
          jsonOutput.writeToFile(report, parseResult.errors, parseResult, resolvedPath);
          console.log(`JSON 报告已写入: ${resolvedPath}`);
        }
      }

      if (outputType === 'markdown' || outputType === 'all' || options.mdOutput) {
        const mdOutput = new MarkdownOutput({ title: options.title });
        const mdPath = options.mdOutput || 
          (outputType === 'markdown' || outputType === 'all')
          ? path.basename(file, path.extname(file)) + '-analysis.md'
          : null;
        
        if (mdPath) {
          const resolvedPath = path.resolve(mdPath);
          mdOutput.writeToFile(report, parseResult.errors, parseResult, resolvedPath);
          console.log(`Markdown 报告已写入: ${resolvedPath}`);
        }
      }

    } catch (error) {
      console.error('分析失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('fingerprint <sql>')
  .description('计算单条 SQL 的指纹')
  .action((sql) => {
    const { processSQL } = require('./fingerprint');
    const result = processSQL(sql);
    
    console.log('SQL 指纹分析结果:');
    console.log('================');
    console.log('指纹:', result.fingerprint);
    console.log('类型:', result.queryType);
    console.log('表名:', result.tables.join(', ') || '未知');
    console.log();
    console.log('归一化 SQL:');
    console.log(result.normalized);
  });

program
  .command('help')
  .description('显示帮助信息')
  .action(() => {
    program.outputHelp();
    console.log();
    console.log('使用示例:');
    console.log('  # 分析 MySQL 慢查询日志');
    console.log('  sql-fingerprint slow-query.log');
    console.log();
    console.log('  # 输出所有格式');
    console.log('  sql-fingerprint slow-query.log -o all');
    console.log();
    console.log('  # 分析简单格式的日志');
    console.log('  sql-fingerprint simple.log -f simple');
    console.log();
    console.log('  # 计算单条 SQL 的指纹');
    console.log('  sql-fingerprint fingerprint "SELECT * FROM users WHERE id = 123"');
  });

program.parse();
