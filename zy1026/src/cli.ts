#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from './config';
import { DocGuardEngine } from './engine';
import { Reporter } from './reporter';
import { Config } from './types';

const program = new Command();

program
  .name('docguard')
  .description('文档发布巡检工具 - 检查 Markdown/MDX 中的图片、链接、锚点和外链')
  .version('1.0.0');

program
  .command('check')
  .description('检查文档目录中的链接和图片')
  .option('-c, --config <path>', '配置文件路径')
  .option('-d, --docs <path>', '文档目录路径')
  .option('--no-external', '跳过外部链接检查')
  .option('--no-images', '跳过图片检查')
  .option('--no-anchors', '跳过锚点检查')
  .option('--markdown', '输出 Markdown 报告')
  .option('--html', '输出 HTML 报告')
  .option('--json', '输出 JSON 结果')
  .option('--output <path>', '输出文件路径前缀')
  .option('--clear-cache', '清除缓存后再运行')
  .action(async (options) => {
    try {
      const configManager = options.config 
        ? new ConfigManager(options.config)
        : new ConfigManager();
      
      let config = configManager.getConfig();

      if (options.docs) {
        config.docsDir = options.docs;
      }

      if (options.external === false) {
        config.external.enabled = false;
      }

      if (options.images === false) {
        config.images.enabled = false;
      }

      if (options.anchors === false) {
        config.anchors.enabled = false;
      }

      if (options.markdown) {
        config.output.markdown = true;
      }

      if (options.html) {
        config.output.html = true;
      }

      if (options.json) {
        config.output.json = true;
      }

      if (options.output) {
        if (config.output.markdownPath) {
          config.output.markdownPath = `${options.output}.md`;
        }
        if (config.output.htmlPath) {
          config.output.htmlPath = `${options.output}.html`;
        }
        if (config.output.jsonPath) {
          config.output.jsonPath = `${options.output}.json`;
        }
      }

      const engine = new DocGuardEngine(config);
      
      console.log('🔍 开始检查文档...\n');

      const result = await engine.run();

      const reporter = new Reporter(result);
      
      if (config.output.terminal) {
        reporter.printTerminalSummary();
      }

      reporter.writeReports();

      console.log(`\n检查完成，退出码: ${result.exitCode}`);
      
      process.exit(result.exitCode);
    } catch (error) {
      console.error('❌ 执行出错:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('初始化配置文件')
  .option('-c, --config <path>', '配置文件路径')
  .action((options) => {
    const configPath = options.config || 'docguard.config.json';
    ConfigManager.initConfig(configPath);
    console.log('\n配置文件已初始化，可以根据需要修改配置后运行:');
    console.log('  docguard check');
  });

program
  .command('cache')
  .description('缓存管理')
  .option('-c, --config <path>', '配置文件路径')
  .option('--clear', '清除缓存')
  .option('--stats', '查看缓存统计')
  .action(async (options) => {
    const configManager = options.config 
      ? new ConfigManager(options.config)
      : new ConfigManager();
    
    const config = configManager.getConfig();

    if (options.clear) {
      const { ExternalValidator } = await import('./validators/external-validator');
      const validator = new ExternalValidator(config);
      validator.clearCache();
      console.log('✅ 缓存已清除');
    }

    if (options.stats) {
      const { ExternalValidator } = await import('./validators/external-validator');
      const validator = new ExternalValidator(config);
      const stats = validator.getCacheStats();
      console.log('📊 缓存统计:');
      console.log(`  有效缓存: ${stats.cached} 个`);
      console.log(`  过期缓存: ${stats.expired} 个`);
    }

    if (!options.clear && !options.stats) {
      console.log('请使用 --clear 或 --stats 选项');
    }
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
