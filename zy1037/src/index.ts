import { Command } from 'commander';
import { runInit } from './cli/commands/init';
import { runInspect } from './cli/commands/inspect';
import { runValidate } from './cli/commands/validate';
import { runReport } from './cli/commands/report';

const program = new Command();

program
  .name('pdc')
  .description('播客交付体检工具 - 在上传之前检查音频文件、响度、章节时间等')
  .version('0.1.0');

program
  .command('init')
  .description('初始化播客项目，生成示例 manifest 和目录结构')
  .option('-f, --format <format>', 'manifest 格式: yaml 或 json', 'yaml')
  .option('-n, --name <name>', '播客名称', '我的播客')
  .option('-e, --episode <episode>', '节目期数', 'EP001 - 第一期节目')
  .option('-o, --output <directory>', '输出目录', '.')
  .option('--no-create-audio-dir', '不创建 audio 目录')
  .action(async (options) => {
    try {
      await runInit({
        format: options.format as 'yaml' | 'json',
        name: options.name,
        episode: options.episode,
        output: options.output,
        createAudioDir: options.createAudioDir !== false,
      });
    } catch (error) {
      console.error('初始化失败:', error);
      process.exit(1);
    }
  });

program
  .command('inspect')
  .description('检查音频文件，输出时长、采样率、响度等信息')
  .argument('<manifest>', 'manifest 文件路径 (yaml 或 json)')
  .option('-v, --verbose', '详细输出')
  .option('--json', '以 JSON 格式输出')
  .action(async (manifestPath, options) => {
    try {
      await runInspect(manifestPath, {
        verbose: options.verbose,
        json: options.json,
      });
    } catch (error) {
      console.error('检查失败:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('执行完整验证，检查所有交付标准')
  .argument('<manifest>', 'manifest 文件路径 (yaml 或 json)')
  .option('-v, --verbose', '详细输出问题信息')
  .option('--json', '以 JSON 格式输出')
  .option('--loudness-doc', '显示响度计算说明文档')
  .action(async (manifestPath, options) => {
    try {
      await runValidate(manifestPath, {
        verbose: options.verbose,
        json: options.json,
        showLoudnessDoc: options.loudnessDoc,
      });
    } catch (error) {
      console.error('验证失败:', error);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('导出交付体检报告 (Markdown/HTML/JSON)')
  .argument('<manifest>', 'manifest 文件路径 (yaml 或 json)')
  .option('-f, --format <format>', '报告格式: markdown, html, json, 或 all', 'all')
  .option('-o, --output <path>', '输出文件或目录')
  .option('-n, --name <name>', '报告文件名 (不含扩展名)', 'delivery-check-report')
  .action(async (manifestPath, options) => {
    try {
      await runReport(manifestPath, {
        format: options.format as 'markdown' | 'html' | 'json' | 'all',
        output: options.output,
        name: options.name,
      });
    } catch (error) {
      console.error('生成报告失败:', error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error('错误:', error.message);
  process.exit(1);
});
