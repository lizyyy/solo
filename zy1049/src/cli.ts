#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PluginManager } from './plugin-manager.js';
import { SandboxRunner } from './sandbox-runner.js';
import { PermissionAuditor } from './permission-auditor.js';
import { ReportGenerator } from './report-generator.js';
import { PluginLogger } from './logger.js';
import { ReportWebServer } from './web-server.js';
import { PluginAuditReport, BatchAuditReport } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('plugin-sandbox')
  .description('插件沙盒权限演练器 - 安全审计第三方插件')
  .version('1.0.0');

program
  .command('list')
  .description('列出所有发现的插件')
  .option('-p, --plugins-dir <path>', '插件目录', 'plugins')
  .option('-v, --verbose', '显示详细信息')
  .action(async (options) => {
    const pluginsDir = path.resolve(options.pluginsDir);
    console.log(`\n📂 插件目录: ${pluginsDir}\n`);

    const manager = new PluginManager(pluginsDir);
    const plugins = await manager.discoverPlugins();

    if (plugins.length === 0) {
      console.log('❌ 未发现任何插件');
      console.log(`   请将插件放入 ${pluginsDir} 目录`);
      console.log('   每个插件需要包含 manifest.json 和入口脚本文件');
      return;
    }

    console.log(`✅ 发现 ${plugins.length} 个插件:\n`);

    for (const plugin of plugins) {
      const status = plugin.manifestValid ? '✅ 有效' : '❌ 无效';
      console.log(`  📦 ${plugin.name} (v${plugin.version})`);
      console.log(`     状态: ${status}`);
      console.log(`     路径: ${plugin.path}`);
      
      if (options.verbose) {
        console.log(`     入口: ${plugin.mainPath}`);
        console.log(`     权限: ${plugin.manifest.permissions.join(', ') || '无'}`);
      }
      
      if (!plugin.manifestValid) {
        console.log(`     错误: ${plugin.validationErrors.join('; ')}`);
      }
      console.log('');
    }
  });

program
  .command('validate')
  .description('验证插件 manifest.json')
  .option('-p, --plugins-dir <path>', '插件目录', 'plugins')
  .option('-n, --name <plugin>', '指定插件名称（不指定则验证所有）')
  .action(async (options) => {
    const pluginsDir = path.resolve(options.pluginsDir);
    const manager = new PluginManager(pluginsDir);
    
    let plugins = await manager.discoverPlugins();
    
    if (options.name) {
      const plugin = plugins.find(p => p.name === options.name);
      if (!plugin) {
        console.error(`❌ 未找到插件: ${options.name}`);
        process.exit(1);
      }
      plugins = [plugin];
    }

    let validCount = 0;
    let invalidCount = 0;

    console.log('\n🔍 验证插件 manifest.json...\n');

    for (const plugin of plugins) {
      if (plugin.manifestValid) {
        console.log(`✅ ${plugin.name}: manifest 有效`);
        validCount++;
      } else {
        console.log(`❌ ${plugin.name}: manifest 无效`);
        for (const error of plugin.validationErrors) {
          console.log(`   - ${error}`);
        }
        invalidCount++;
      }
    }

    console.log(`\n📊 验证结果: ${validCount} 有效, ${invalidCount} 无效`);
    
    if (invalidCount > 0) {
      process.exit(1);
    }
  });

program
  .command('run')
  .description('在沙盒中运行插件并进行权限审计')
  .option('-p, --plugins-dir <path>', '插件目录', 'plugins')
  .option('-o, --output-dir <path>', '输出目录', 'output')
  .option('-n, --name <plugin>', '指定插件名称（不指定则运行所有）')
  .option('-t, --timeout <ms>', '默认超时时间(毫秒)', '30000')
  .option('-s, --serve', '启动 Web 服务器展示报告')
  .option('--port <port>', 'Web 服务器端口', '3000')
  .option('-v, --verbose', '显示详细输出')
  .action(async (options) => {
    const pluginsDir = path.resolve(options.pluginsDir);
    const outputDir = path.resolve(options.outputDir);
    const defaultTimeout = parseInt(options.timeout, 10);
    const servePort = parseInt(options.port, 10);

    const logger = new PluginLogger(outputDir, options.verbose);
    const runId = `run-${Date.now()}`;
    logger.setRunId(runId);

    logger.info('=== 插件沙盒权限审计工具启动 ===');
    logger.info(`插件目录: ${pluginsDir}`);
    logger.info(`输出目录: ${outputDir}`);
    logger.info(`运行 ID: ${runId}`);
    logger.info(`默认超时: ${defaultTimeout}ms`);

    const manager = new PluginManager(pluginsDir);
    let allPlugins = await manager.discoverPlugins();

    if (options.name) {
      const plugin = allPlugins.find(p => p.name === options.name);
      if (!plugin) {
        logger.error(`未找到插件: ${options.name}`);
        process.exit(1);
      }
      allPlugins = [plugin];
    }

    const validPlugins = allPlugins.filter(p => p.manifestValid);
    const invalidPlugins = allPlugins.filter(p => !p.manifestValid);

    if (invalidPlugins.length > 0) {
      logger.warn(`跳过 ${invalidPlugins.length} 个无效插件`);
      for (const p of invalidPlugins) {
        logger.warn(`  - ${p.name}: ${p.validationErrors.join('; ')}`);
      }
    }

    if (validPlugins.length === 0) {
      logger.error('没有有效的插件可以运行');
      process.exit(1);
    }

    logger.info(`准备运行 ${validPlugins.length} 个插件...\n`);

    const pluginReports: PluginAuditReport[] = [];
    const reportGenerator = new ReportGenerator(outputDir);

    for (const plugin of validPlugins) {
      logger.info(`\n========================================`);
      logger.info(`运行插件: ${plugin.name} v${plugin.version}`);
      logger.info(`========================================`);

      try {
        const runner = new SandboxRunner(plugin, defaultTimeout);
        const runResult = await runner.run();

        logger.info(`运行结果: ${runResult.success ? '成功' : '失败'}`);
        logger.info(`运行时长: ${runResult.duration}ms`);
        
        if (runResult.timeout) {
          logger.warn('插件运行超时');
        }
        if (runResult.crashed) {
          logger.error('插件崩溃:', runResult.errorMessage);
        }

        logger.info(`能力调用次数: ${runResult.capabilityCalls.length}`);
        logger.info(`事件记录: ${runResult.events.length}`);
        logger.info(`控制台输出: ${runResult.consoleOutput.length} 行`);

        const auditor = new PermissionAuditor(runResult, plugin.manifest);
        const auditReport = auditor.audit();
        pluginReports.push(auditReport);

        const violations = PermissionAuditor.getViolations(auditReport);
        const warnings = PermissionAuditor.getWarnings(auditReport);

        logger.info(`\n审计结果:`);
        logger.info(`  违规 (Violations): ${violations.length}`);
        logger.info(`  警告 (Warnings): ${warnings.length}`);

        for (const v of violations) {
          logger.error(`  - [${v.severity.toUpperCase()}] ${v.message}`);
        }

        for (const w of warnings) {
          logger.warn(`  - [${w.severity.toUpperCase()}] ${w.message}`);
        }

        const reportPaths = await reportGenerator.generateFullReport(auditReport);
        logger.info(`\n报告已保存:`);
        logger.info(`  JSON: ${reportPaths.json}`);
        logger.info(`  Markdown: ${reportPaths.markdown}`);

        await logger.persistPluginOutput(plugin.name, runResult.consoleOutput);

      } catch (error) {
        logger.error(`运行插件 ${plugin.name} 时出错:`, (error as Error).message);
        logger.error(`堆栈:`, (error as Error).stack);
      }
    }

    const passed = pluginReports.filter(r => 
      r.runSummary.success && !PermissionAuditor.hasViolations(r)
    ).length;

    const failed = pluginReports.filter(r => !r.runSummary.success).length;
    const crashed = pluginReports.filter(r => r.runSummary.crashed).length;
    const timeout = pluginReports.filter(r => r.runSummary.timeout).length;
    const totalViolations = pluginReports.reduce(
      (sum, r) => sum + PermissionAuditor.getViolations(r).length, 0
    );
    const totalWarnings = pluginReports.reduce(
      (sum, r) => sum + PermissionAuditor.getWarnings(r).length, 0
    );

    const batchReport: BatchAuditReport = {
      runId,
      generatedAt: Date.now(),
      pluginsCount: pluginReports.length,
      plugins: pluginReports,
      summary: {
        total: pluginReports.length,
        passed,
        failed,
        crashed,
        timeout,
        violations: totalViolations,
        warnings: totalWarnings,
      },
    };

    const batchReportPaths = await reportGenerator.generateFullBatchReport(batchReport);
    logger.info(`\n========================================`);
    logger.info(`🏁 批量审计完成`);
    logger.info(`========================================`);
    logger.info(`总计: ${batchReport.summary.total} 个插件`);
    logger.info(`通过: ${batchReport.summary.passed}`);
    logger.info(`失败: ${batchReport.summary.failed}`);
    logger.info(`崩溃: ${batchReport.summary.crashed}`);
    logger.info(`超时: ${batchReport.summary.timeout}`);
    logger.info(`违规: ${batchReport.summary.violations}`);
    logger.info(`警告: ${batchReport.summary.warnings}`);
    logger.info(`\n批量报告已保存:`);
    logger.info(`  JSON: ${batchReportPaths.json}`);
    logger.info(`  Markdown: ${batchReportPaths.markdown}`);

    await logger.persistLog();

    if (options.serve) {
      const server = new ReportWebServer({
        port: servePort,
        outputDir,
        reports: pluginReports,
        batchReport,
      });

      await server.start();

      process.on('SIGINT', async () => {
        console.log('\n正在停止服务器...');
        await server.stop();
        process.exit(0);
      });
    } else {
      if (batchReport.summary.violations > 0 || batchReport.summary.failed > 0) {
        process.exit(1);
      }
    }
  });

program
  .command('permissions')
  .description('显示支持的权限列表')
  .action(() => {
    console.log('\n🔒 支持的权限列表:\n');
    
    const permissions = [
      { name: 'fs:read', desc: '读取文件系统 - 读取文件、检查文件存在、列出目录' },
      { name: 'fs:write', desc: '写入文件系统 - 创建、修改文件' },
      { name: 'fs:delete', desc: '删除文件系统 - 删除文件和目录' },
      { name: 'network:fetch', desc: '网络请求 - 使用 fetch API' },
      { name: 'network:http', desc: 'HTTP 请求 - 底层 HTTP 操作' },
      { name: 'env:read', desc: '读取环境变量' },
      { name: 'env:write', desc: '写入环境变量' },
      { name: 'event:subscribe', desc: '订阅事件总线' },
      { name: 'event:publish', desc: '发布事件到事件总线' },
      { name: 'process:spawn', desc: '创建子进程' },
      { name: 'process:exec', desc: '执行 shell 命令' },
    ];

    console.log(`| 权限名称 | 描述 |`);
    console.log(`|----------|------|`);
    for (const p of permissions) {
      console.log(`| \`${p.name}\` | ${p.desc} |`);
    }
    
    console.log('\n📋 使用方式:');
    console.log('在插件的 manifest.json 中声明所需权限:');
    console.log('```json');
    console.log('{');
    console.log('  "permissions": ["fs:read", "fs:write", "event:publish"]');
    console.log('}');
    console.log('```\n');
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
