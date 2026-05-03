#!/usr/bin/env node

import { program } from 'commander';
import * as path from 'path';
import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { planCommand } from './commands/plan';
import { rollbackCommand } from './commands/rollback';
import { exportCommand } from './commands/export';
import { ConfigManager } from './core/config-manager';
import { OutputUtils } from './utils/output-utils';

// 版本信息
const version = '1.0.0';

// 配置管理器
const configManager = new ConfigManager();
const config = configManager.loadConfig();

program
  .name('release-plan')
  .description('小团队发版前准备工具 - 汇总变更、评估风险、生成回滚清单')
  .version(version);

// init 命令
program
  .command('init')
  .description('初始化示例数据目录和文件')
  .option('-d, --data-dir <dir>', '数据目录路径', config.dataDirectory)
  .action(async (options) => {
    try {
      const dataDir = path.isAbsolute(options.dataDir) 
        ? options.dataDir 
        : path.join(process.cwd(), options.dataDir);
      
      await initCommand(dataDir);
      
      // 保存配置
      configManager.updateConfig({ dataDirectory: dataDir });
      
    } catch (error) {
      OutputUtils.error(`初始化失败: ${(error as Error).message}`);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

// validate 命令
program
  .command('validate')
  .description('校验输入数据的完整性和格式')
  .option('-d, --data-dir <dir>', '数据目录路径', config.dataDirectory)
  .option('--export', '导出校验结果到文件')
  .option('-o, --output-dir <dir>', '输出目录', config.outputDirectory)
  .action(async (options) => {
    try {
      const dataDir = path.isAbsolute(options.dataDir) 
        ? options.dataDir 
        : path.join(process.cwd(), options.dataDir);
      
      const result = await validateCommand(dataDir);
      
      // 导出校验结果
      if (options.export) {
        const outputDir = path.isAbsolute(options.outputDir)
          ? options.outputDir
          : path.join(process.cwd(), options.outputDir);
        
        // 这里简单导出JSON格式
        const { Exporter } = await import('./core/exporter');
        const exporter = new Exporter(outputDir);
        const files = exporter.exportValidationResult(result, 'validation', ['json', 'markdown']);
        
        OutputUtils.info('');
        OutputUtils.success(`校验结果已导出到: ${outputDir}`);
        files.forEach(file => OutputUtils.info(`  - ${file}`));
      }
      
      // 记录历史
      configManager.addHistory({
        command: 'validate',
        version: 'unknown',
        status: result.valid ? 'success' : 'failed',
        summary: `校验完成，${result.errors.length} 个错误，${result.warnings.length} 个警告`
      });
      
      if (!result.valid) {
        process.exit(1);
      }
      
    } catch (error) {
      OutputUtils.error(`校验失败: ${(error as Error).message}`);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

// plan 命令
program
  .command('plan')
  .description('汇总版本变更、风险和影响面')
  .option('-d, --data-dir <dir>', '数据目录路径', config.dataDirectory)
  .option('--skip-validation', '跳过数据校验')
  .action(async (options) => {
    try {
      const dataDir = path.isAbsolute(options.dataDir) 
        ? options.dataDir 
        : path.join(process.cwd(), options.dataDir);
      
      const plan = await planCommand(dataDir, {
        skipValidation: options.skipValidation
      });
      
      // 记录历史
      configManager.addHistory({
        command: 'plan',
        version: plan.version,
        status: plan.analysis.rollbackReadiness.isReady ? 'success' : 'warning',
        summary: `版本 ${plan.version}，风险等级: ${plan.analysis.riskAssessment.overallRisk}`
      });
      
    } catch (error) {
      OutputUtils.error(`生成发版计划失败: ${(error as Error).message}`);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

// rollback 命令
program
  .command('rollback')
  .description('生成回滚核对清单')
  .option('-d, --data-dir <dir>', '数据目录路径', config.dataDirectory)
  .action(async (options) => {
    try {
      const dataDir = path.isAbsolute(options.dataDir) 
        ? options.dataDir 
        : path.join(process.cwd(), options.dataDir);
      
      const readiness = await rollbackCommand(dataDir);
      
      // 记录历史
      configManager.addHistory({
        command: 'rollback',
        version: 'unknown',
        status: readiness.isReady ? 'success' : 'warning',
        summary: readiness.isReady 
          ? '回滚准备就绪' 
          : `缺失 ${readiness.missingRollbackPlans.length} 个回滚计划`
      });
      
      if (!readiness.isReady && readiness.missingRollbackPlans.length > 0) {
        OutputUtils.warning('');
        OutputUtils.warning('提示: 存在缺失的回滚计划，请补充后再继续');
      }
      
    } catch (error) {
      OutputUtils.error(`生成回滚清单失败: ${(error as Error).message}`);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

// export 命令
program
  .command('export')
  .description('导出发版计划到指定格式')
  .option('-d, --data-dir <dir>', '数据目录路径', config.dataDirectory)
  .option('-o, --output-dir <dir>', '输出目录', config.outputDirectory)
  .option('--format <format>', '导出格式: json, markdown, html (可多次使用)', (value, previous: string[]) => {
    previous.push(value);
    return previous;
  }, [] as string[])
  .action(async (options) => {
    try {
      const dataDir = path.isAbsolute(options.dataDir) 
        ? options.dataDir 
        : path.join(process.cwd(), options.dataDir);
      
      const outputDir = path.isAbsolute(options.outputDir)
        ? options.outputDir
        : path.join(process.cwd(), options.outputDir);
      
      // 解析格式
      let formats: ('json' | 'markdown' | 'html')[];
      if (options.format.length === 0) {
        formats = ['json', 'markdown', 'html'];
      } else {
        formats = options.format.map((f: string) => {
          const lower = f.toLowerCase();
          if (lower === 'md') return 'markdown';
          if (lower === 'htm') return 'html';
          return lower as 'json' | 'markdown' | 'html';
        }).filter((f: string) => ['json', 'markdown', 'html'].includes(f)) as ('json' | 'markdown' | 'html')[];
        
        if (formats.length === 0) {
          throw new Error('无效的格式，支持: json, markdown, html');
        }
      }
      
      const exportedFiles = await exportCommand(dataDir, outputDir, formats);
      
      // 保存配置
      configManager.updateConfig({ outputDirectory: outputDir });
      
      // 记录历史
      configManager.addHistory({
        command: 'export',
        version: 'unknown',
        status: 'success',
        summary: `导出 ${exportedFiles.length} 个文件到 ${outputDir}`
      });
      
    } catch (error) {
      OutputUtils.error(`导出失败: ${(error as Error).message}`);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

// config 命令
program
  .command('config')
  .description('查看或更新配置')
  .option('--set <key=value>', '设置配置项 (可多次使用)', (value, previous: string[]) => {
    previous.push(value);
    return previous;
  }, [] as string[])
  .option('--reset', '重置为默认配置')
  .option('--show', '显示当前配置')
  .action(async (options) => {
    try {
      // 重置配置
      if (options.reset) {
        const defaultConfig = configManager.getDefaultConfig();
        configManager.saveConfig(defaultConfig);
        OutputUtils.success('配置已重置为默认值');
        return;
      }
      
      // 设置配置
      if (options.set.length > 0) {
        const updates: Record<string, any> = {};
        
        for (const item of options.set) {
          const [key, ...valueParts] = item.split('=');
          const value = valueParts.join('=');
          
          if (key && value) {
            // 处理特殊字段
            if (key === 'dataDirectory' || key === 'outputDirectory' || key === 'defaultEnvironment') {
              updates[key] = value;
            } else {
              OutputUtils.warning(`忽略未知配置项: ${key}`);
            }
          }
        }
        
        if (Object.keys(updates).length > 0) {
          configManager.updateConfig(updates);
          OutputUtils.success('配置已更新');
        }
        return;
      }
      
      // 默认显示配置
      const currentConfig = configManager.loadConfig();
      OutputUtils.title('当前配置');
      console.log(JSON.stringify(currentConfig, null, 2));
      console.log('');
      OutputUtils.info(`配置文件位置: ${configManager.getConfigPath()}`);
      OutputUtils.info(`历史记录位置: ${configManager.getHistoryPath()}`);
      
    } catch (error) {
      OutputUtils.error(`配置操作失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// history 命令
program
  .command('history')
  .description('查看执行历史')
  .option('-n, --limit <number>', '显示最近的N条记录', '10')
  .option('--clear', '清空历史记录')
  .action(async (options) => {
    try {
      // 清空历史
      if (options.clear) {
        configManager.clearHistory();
        OutputUtils.success('历史记录已清空');
        return;
      }
      
      // 显示历史
      const limit = parseInt(options.limit) || 10;
      const history = configManager.getRecentHistory(limit);
      
      if (history.length === 0) {
        OutputUtils.info('暂无历史记录');
        return;
      }
      
      OutputUtils.title(`执行历史 (最近 ${history.length} 条)`);
      console.log('');
      
      history.forEach((record, index) => {
        const statusColor = record.status === 'success' ? '✅' : record.status === 'warning' ? '⚠️' : '❌';
        const timestamp = new Date(record.timestamp).toLocaleString('zh-CN');
        
        console.log(`${statusColor} [${timestamp}] ${record.command}`);
        console.log(`    版本: ${record.version}`);
        console.log(`    摘要: ${record.summary}`);
        console.log('');
      });
      
    } catch (error) {
      OutputUtils.error(`获取历史记录失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse(process.argv);

// 如果没有指定命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
