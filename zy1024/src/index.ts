#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';

import { ConfigParser, ConfigValidationResult } from './config/parser';
import { AnalysisEngine } from './analyzer/engine';
import { ReportGenerator } from './reporter/generator';
import { getSampleDataset, sampleDatasets, listSampleDatasets } from './samples';
import { ScanOptions, ExportOptions, ReleaseScopeConfig } from './types';

const packageJson = require('../package.json');

const program = new Command();

program
  .name('release-scope')
  .description('分析 Git 改动并生成影响面报告的 CLI 工具')
  .version(packageJson.version);

function findConfigFile(projectDir: string): string | null {
  const possibleNames = [
    'release-scope.yaml',
    'release-scope.yml',
    'release-scope.json',
    '.release-scope.yaml',
    '.release-scope.yml',
    '.release-scope.json'
  ];
  
  for (const name of possibleNames) {
    const configPath = path.join(projectDir, name);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  
  return null;
}

async function loadConfig(configPath?: string, projectDir?: string): Promise<ReleaseScopeConfig> {
  if (configPath) {
    const parser = new ConfigParser(configPath);
    return parser.parse();
  }
  
  if (projectDir) {
    const foundPath = findConfigFile(projectDir);
    if (foundPath) {
      const parser = new ConfigParser(foundPath);
      return parser.parse();
    }
  }
  
  throw new Error('未找到配置文件。请使用 --config 指定配置文件，或在项目目录中创建 release-scope.yaml');
}

async function runAnalysis(options: {
  projectDir?: string;
  config?: string;
  from?: string;
  to?: string;
  sample?: string;
  useSample?: boolean;
}): Promise<{ report: any; config: ReleaseScopeConfig }> {
  const projectDir = options.projectDir || process.cwd();
  
  let config: ReleaseScopeConfig;
  
  if (options.useSample || options.sample) {
    const sampleKey = options.sample || 'frontend-backend';
    const sample = getSampleDataset(sampleKey);
    if (!sample) {
      throw new Error(`示例数据集不存在: ${sampleKey}`);
    }
    config = ConfigParser.parseFromString(sample.sampleConfig);
  } else {
    config = await loadConfig(options.config, projectDir);
  }
  
  const scanOptions: ScanOptions = {
    projectDir,
    configPath: options.config,
    fromRef: options.from,
    toRef: options.to,
    useSampleData: options.useSample || !!options.sample,
    sampleKey: options.sample
  };
  
  const engine = new AnalysisEngine(config);
  const result = await engine.analyze(scanOptions);
  
  return { report: result.report, config };
}

program
  .command('scan')
  .description('扫描 Git 改动并生成影响面报告')
  .option('-p, --project-dir <path>', '项目目录路径 (默认: 当前目录)')
  .option('-c, --config <path>', '配置文件路径 (YAML/JSON)')
  .option('-f, --from <ref>', '起始 commit/ref')
  .option('-t, --to <ref>', '结束 commit/ref (默认: HEAD)')
  .option('-s, --sample [key]', '使用内置示例数据，可选指定示例 key')
  .option('--json', '以 JSON 格式输出报告')
  .option('--md', '以 Markdown 格式输出报告')
  .action(async (options) => {
    try {
      const { report } = await runAnalysis({
        projectDir: options.projectDir,
        config: options.config,
        from: options.from,
        to: options.to,
        sample: options.sample === true ? undefined : options.sample,
        useSample: options.sample === true
      });
      
      const generator = new ReportGenerator(report);
      
      if (options.json) {
        console.log(generator.generateJSON(true));
      } else if (options.md) {
        console.log(generator.generateMarkdown());
      } else {
        console.log(generator.generateTerminalTable());
      }
      
      if (report.summary.criticalFiles > 0) {
        console.log('\n' + chalk.red.bold('⚠️  存在 Critical 级别的改动，请务必仔细审查！'));
      }
      
    } catch (error) {
      console.error(chalk.red('错误:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('explain-config')
  .description('解析并解释配置文件，显示校验结果')
  .argument('[path]', '配置文件路径')
  .option('-p, --project-dir <path>', '项目目录路径')
  .option('--full', '显示完整的配置详情')
  .action(async (configPath, options) => {
    try {
      const projectDir = options.projectDir || process.cwd();
      let actualPath = configPath;
      
      if (!actualPath) {
        actualPath = findConfigFile(projectDir);
        if (!actualPath) {
          throw new Error('未找到配置文件');
        }
      }
      
      console.log(chalk.bold(`📋 配置文件: ${actualPath}`));
      console.log('');
      
      const parser = new ConfigParser(actualPath);
      const validation = await parser.validate();
      
      if (validation.valid) {
        console.log(chalk.green('✅ 配置文件语法正确'));
      } else {
        console.log(chalk.red('❌ 配置文件存在错误:'));
        for (const error of validation.errors) {
          console.log(`  ${chalk.red('-')} [${error.field}] ${error.message}`);
        }
        process.exit(1);
      }
      
      if (validation.warnings.length > 0) {
        console.log('');
        console.log(chalk.yellow('⚠️  警告:'));
        for (const warning of validation.warnings) {
          console.log(`  ${chalk.yellow('-')} [${warning.field}] ${warning.message}`);
        }
      }
      
      if (options.full) {
        console.log('');
        console.log(chalk.bold('📦 模块配置:'));
        
        const config = await parser.parse();
        
        for (const module of config.modules) {
          console.log('');
          console.log(chalk.bold(`  ${module.name}`));
          console.log(`    路径模式: ${module.paths.join(', ')}`);
          console.log(`    负责人: ${module.owners.join(', ') || '未指定'}`);
          console.log(`    默认风险等级: ${module.riskLevel}`);
          console.log(`    检查命令: ${module.defaultCheckCommands.length} 个`);
        }
        
        console.log('');
        console.log(chalk.bold('📏 规则配置:'));
        
        for (const rule of config.rules) {
          console.log('');
          console.log(chalk.bold(`  ${rule.name} (${rule.id})`));
          if (rule.description) {
            console.log(`    描述: ${rule.description}`);
          }
          console.log(`    风险等级: ${rule.riskLevel}`);
          console.log(`    阻断级别: ${rule.blockingLevel}`);
          
          const matchers: string[] = [];
          if (rule.paths && rule.paths.length > 0) matchers.push(`路径: ${rule.paths.length} 个`);
          if (rule.fileTypes && rule.fileTypes.length > 0) matchers.push(`文件类型: ${rule.fileTypes.length} 个`);
          if (rule.keywords && rule.keywords.length > 0) matchers.push(`关键字: ${rule.keywords.length} 个`);
          if (rule.modules && rule.modules.length > 0) matchers.push(`模块: ${rule.modules.join(', ')}`);
          if (rule.owners && rule.owners.length > 0) matchers.push(`负责人: ${rule.owners.join(', ')}`);
          
          console.log(`    匹配条件: ${matchers.join(' | ')}`);
          console.log(`    检查命令: ${rule.checkCommands.length} 个`);
          if (rule.confirmations && rule.confirmations.length > 0) {
            console.log(`    确认事项: ${rule.confirmations.length} 个`);
          }
        }
        
        if (config.globalCheckCommands && config.globalCheckCommands.length > 0) {
          console.log('');
          console.log(chalk.bold('🌍 全局检查命令:'));
          for (const cmd of config.globalCheckCommands) {
            console.log(`  - ${cmd}`);
          }
        }
      }
      
    } catch (error) {
      console.error(chalk.red('错误:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('init-sample')
  .description('初始化示例配置文件')
  .option('-o, --output <path>', '输出文件路径 (默认: release-scope.yaml)')
  .option('-s, --sample <key>', '使用指定的示例配置 (可用: frontend-backend, mobile-only)')
  .option('--force', '覆盖已存在的文件')
  .action(async (options) => {
    try {
      const sampleKey = options.sample || 'frontend-backend';
      const sample = getSampleDataset(sampleKey);
      
      if (!sample) {
        console.error(chalk.red(`示例数据集不存在: ${sampleKey}`));
        console.log('可用的示例:');
        for (const ds of listSampleDatasets()) {
          console.log(`  ${chalk.cyan(ds.key)} - ${ds.description}`);
        }
        process.exit(1);
      }
      
      const outputPath = options.output || 'release-scope.yaml';
      
      if (fs.existsSync(outputPath) && !options.force) {
        console.error(chalk.red(`文件已存在: ${outputPath}`));
        console.log('使用 --force 选项覆盖现有文件');
        process.exit(1);
      }
      
      await fs.promises.writeFile(outputPath, sample.sampleConfig, 'utf-8');
      
      console.log(chalk.green(`✅ 已生成配置文件: ${outputPath}`));
      console.log('');
      console.log('使用说明:');
      console.log(`  1. 编辑 ${outputPath}，根据实际项目修改模块和规则配置`);
      console.log(`  2. 运行 ${chalk.cyan('release-scope scan')} 分析当前工作区改动`);
      console.log(`  3. 或运行 ${chalk.cyan('release-scope scan -f v1.0.0 -t v1.1.0')} 分析两个版本之间的改动`);
      console.log('');
      console.log(`示例: ${chalk.cyan('release-scope scan --sample')} 使用内置示例数据查看报告效果`);
      
    } catch (error) {
      console.error(chalk.red('错误:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出报告到文件')
  .option('-p, --project-dir <path>', '项目目录路径 (默认: 当前目录)')
  .option('-c, --config <path>', '配置文件路径')
  .option('-f, --from <ref>', '起始 commit/ref')
  .option('-t, --to <ref>', '结束 commit/ref')
  .option('-s, --sample [key]', '使用内置示例数据')
  .option('-o, --output <path>', '输出文件路径')
  .option('--format <format>', '输出格式 (json 或 markdown，默认根据扩展名推断)', 'auto')
  .action(async (options) => {
    try {
      const { report } = await runAnalysis({
        projectDir: options.projectDir,
        config: options.config,
        from: options.from,
        to: options.to,
        sample: options.sample === true ? undefined : options.sample,
        useSample: options.sample === true
      });
      
      let format: 'json' | 'markdown';
      
      if (options.format === 'json') {
        format = 'json';
      } else if (options.format === 'markdown' || options.format === 'md') {
        format = 'markdown';
      } else if (options.output) {
        const ext = path.extname(options.output).toLowerCase();
        if (ext === '.json') {
          format = 'json';
        } else {
          format = 'markdown';
        }
      } else {
        format = 'markdown';
      }
      
      const generator = new ReportGenerator(report);
      
      let outputPath = options.output;
      if (!outputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ext = format === 'json' ? 'json' : 'md';
        outputPath = `release-scope-report-${timestamp}.${ext}`;
      }
      
      await generator.exportToFile(outputPath, format);
      
      console.log(chalk.green(`✅ 报告已导出: ${outputPath}`));
      
    } catch (error) {
      console.error(chalk.red('错误:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('list-samples')
  .description('列出所有内置示例数据集')
  .action(() => {
    console.log(chalk.bold('📦 可用的示例数据集:'));
    console.log('');
    
    for (const sample of listSampleDatasets()) {
      console.log(chalk.cyan(`  ${sample.key}`));
      console.log(`    名称: ${sample.name}`);
      console.log(`    描述: ${sample.description}`);
      console.log('');
    }
    
    console.log(`使用示例: ${chalk.cyan('release-scope scan --sample frontend-backend')}`);
  });

program.parse(process.argv);
