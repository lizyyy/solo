#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const { analyzeMetrics } = require('../src/index');

const program = new Command();

program
  .name('metric-impact')
  .description('指标配置仓库口径变更影响 CLI')
  .version('1.0.0');

program
  .command('analyze')
  .description('分析指标配置口径变更影响')
  .argument('<input>', '输入文件或目录路径')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-n, --name <name>', '报告文件名', 'impact_report')
  .option('-c, --changed <metrics>', '变更的指标ID列表，逗号分隔')
  .option('-t, --type <type>', '变更类型', '口径定义变更')
  .action(async (input, options) => {
    try {
      const inputPath = path.resolve(input);
      const outputDir = path.resolve(options.output);

      const changedMetrics = options.changed
        ? options.changed.split(',').map(m => m.trim())
        : [];

      console.log('开始分析指标配置仓库口径变更影响...');
      console.log(`输入路径: ${inputPath}`);
      console.log(`输出目录: ${outputDir}`);
      if (changedMetrics.length > 0) {
        console.log(`变更指标: ${changedMetrics.join(', ')}`);
      }
      console.log('');

      const result = await analyzeMetrics(inputPath, {
        changedMetrics,
        changeType: options.type,
        outputDir,
        reportName: options.name
      });

      console.log('报告已生成:');
      console.log(`  - 文本报告: ${path.relative(process.cwd(), result.reports.text)}`);
      console.log(`  - JSON报告: ${path.relative(process.cwd(), result.reports.json)}`);
      console.log(`  - 看板列表: ${path.relative(process.cwd(), result.reports.dashboard)}`);
      console.log(`  - 异常报告: ${path.relative(process.cwd(), result.reports.exceptions)}`);
      console.log(`  - 指标列表: ${path.relative(process.cwd(), result.reports.metrics)}`);
      console.log('');

      if (result.aggregated.exceptions.length > 0) {
        console.log('注意: 分析过程中发现以下异常，但已继续处理剩余文件:');
        const exceptionTypes = [...new Set(result.aggregated.exceptions.map(e => e.type))];
        exceptionTypes.forEach(type => {
          const count = result.aggregated.exceptions.filter(e => e.type === type).length;
          console.log(`  - ${type}: ${count} 项`);
        });
        console.log('详细异常请查看异常报告文件。');
      }

      console.log('分析完成!');
    } catch (error) {
      console.error('分析失败:', error.message);
      process.exit(1);
    }
  });

program.parse();
