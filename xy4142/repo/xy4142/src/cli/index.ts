#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

import {
  loadPlugin,
  createBatchManager,
  createStorageManager,
  createExporter,
  LoadedPlugin,
  TestBatch,
  HumanReview
} from '../core';
import { logger } from '../utils';

const program = new Command();

program
  .name('wasm-validate')
  .description('WASM 规则插件验收台 - 工厂质检工程师专用')
  .version('1.0.0');

program
  .command('load-plugin')
  .description('加载并验证 WASM 插件包')
  .argument('<pluginPath>', '插件目录或 manifest.json 路径')
  .option('-s, --system-version <version>', '系统版本号', '1.0.0')
  .option('-a, --allow-capabilities <capabilities...>', '允许的能力权限', [])
  .option('-v, --validate', '执行完整验证流程', true)
  .action(async (pluginPath: string, options) => {
    try {
      console.log(chalk.blue('\n🔍 加载插件...\n'));

      const plugin = await loadPlugin(pluginPath, {
        systemVersion: options.systemVersion,
        allowedCapabilities: options.allowCapabilities
      });

      console.log(chalk.green('✅ 插件加载成功！'));
      console.log(chalk.gray('---\n'));
      console.log(chalk.bold('插件信息：'));
      console.log(`  ID: ${chalk.cyan(plugin.id)}`);
      console.log(`  名称: ${chalk.cyan(plugin.manifest.name)}`);
      console.log(`  版本: ${chalk.cyan(plugin.manifest.version)}`);
      console.log(`  类型: ${chalk.cyan(plugin.manifest.pluginType)}`);
      console.log(`  供应商: ${chalk.cyan(plugin.manifest.vendor || 'N/A')}`);
      console.log('\n');
      console.log(chalk.bold('约束条件：'));
      console.log(`  超时: ${chalk.yellow(plugin.manifest.constraints.timeoutMs)}ms`);
      console.log(`  最大内存页: ${chalk.yellow(plugin.manifest.constraints.memoryPagesMax)}`);

      if (plugin.manifest.capabilities && plugin.manifest.capabilities.length > 0) {
        console.log('\n');
        console.log(chalk.bold('请求的能力权限：'));
        for (const cap of plugin.manifest.capabilities) {
          const isAllowed = options.allowCapabilities.includes(cap);
          const indicator = isAllowed ? chalk.green('✅') : chalk.red('❌');
          console.log(`  ${indicator} ${cap}`);
        }
      }

      console.log(chalk.green('\n✅ 插件验证通过！\n'));
      process.exit(0);

    } catch (error) {
      console.error(chalk.red('\n❌ 插件加载失败：'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      logger.error('Plugin load failed', { error: (error as Error).message });
      process.exit(1);
    }
  });

program
  .command('execute-batch')
  .description('执行测试批次')
  .argument('<pluginPath>', '插件路径')
  .argument('<batchPath>', '测试批次 JSON 文件路径')
  .option('-t, --timeout <ms>', '超时时间（毫秒）', '5000')
  .option('-m, --memory-pages <pages>', '最大内存页数', '16')
  .option('-r, --retry <count>', '重试次数', '0')
  .option('-o, --output <dir>', '结果输出目录', './output')
  .option('-e, --export', '导出报告和审计包', true)
  .action(async (pluginPath: string, batchPath: string, options) => {
    try {
      console.log(chalk.blue('\n🚀 执行测试批次...\n'));

      const plugin = await loadPlugin(pluginPath);
      console.log(chalk.green(`✅ 插件加载成功: ${plugin.id} v${plugin.manifest.version}`));

      const batchData = await fs.readFile(batchPath, 'utf-8');
      const batch: TestBatch = JSON.parse(batchData);
      console.log(chalk.green(`✅ 批次加载成功: ${batch.name} (${batch.testCases.length} 个测试用例)`));

      const manager = await createBatchManager(plugin, {
        timeoutMs: parseInt(options.timeout),
        memoryPagesMax: parseInt(options.memoryPages),
        retryCount: parseInt(options.retry)
      });

      manager.registerBatch(batch);

      console.log(chalk.blue('\n📊 开始执行测试用例...\n'));
      const result = await manager.executeBatch(batch.id);

      console.log(chalk.gray('\n---\n'));
      console.log(chalk.bold('执行结果汇总：'));
      console.log(`  总测试用例: ${chalk.cyan(result.summary.total)}`);
      console.log(`  通过: ${chalk.green(result.summary.passed)}`);
      console.log(`  失败: ${chalk.red(result.summary.failed)}`);
      console.log(`  警告: ${chalk.yellow(result.summary.warnings)}`);
      console.log(`  跳过: ${chalk.gray(result.summary.skipped)}`);

      console.log('\n');
      console.log(chalk.bold('性能指标：'));
      console.log(`  平均执行时间: ${chalk.cyan((result.summary.performance.avgDurationMs / 1000).toFixed(3))}s`);
      console.log(`  最大执行时间: ${chalk.cyan((result.summary.performance.maxDurationMs / 1000).toFixed(3))}s`);
      console.log(`  平均内存使用: ${chalk.cyan(formatBytes(result.summary.performance.avgMemoryBytes))}`);

      const storage = createStorageManager({
        baseDirectory: options.output
      });

      await storage.saveResult(result);

      if (options.export) {
        const exporter = createExporter();
        const exportPath = path.join(options.output, 'exports');
        await fs.ensureDir(exportPath);

        const { reportPath, auditPath } = await exporter.exportAll(
          exportPath,
          result,
          plugin.manifest
        );

        console.log('\n');
        console.log(chalk.bold('导出文件：'));
        console.log(`  📄 Markdown报告: ${chalk.cyan(reportPath)}`);
        console.log(`  📦 审计包: ${chalk.cyan(auditPath)}`);
      }

      const overallStatus = result.overallStatus === 'passed'
        ? chalk.green('✅ 通过')
        : chalk.red('❌ 失败');

      console.log(chalk.gray('\n---\n'));
      console.log(chalk.bold(`整体状态: ${overallStatus}`));
      console.log(chalk.green('\n✅ 批次执行完成！\n'));

      process.exit(result.overallStatus === 'passed' ? 0 : 1);

    } catch (error) {
      console.error(chalk.red('\n❌ 批次执行失败：'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      logger.error('Batch execution failed', { error: (error as Error).message });
      process.exit(1);
    }
  });

program
  .command('list-batches')
  .description('列出已保存的测试批次')
  .option('-d, --data-dir <dir>', '数据目录', './data')
  .action(async (options) => {
    try {
      const storage = createStorageManager({
        baseDirectory: options.dataDir
      });

      const batches = await storage.listBatches();

      if (batches.length === 0) {
        console.log(chalk.yellow('\n📭 没有找到已保存的批次\n'));
        return;
      }

      console.log(chalk.blue('\n📋 已保存的批次：\n'));
      console.log(chalk.bold('  ID'.padEnd(40)) + chalk.bold('名称'.padEnd(30)) + chalk.bold('测试用例数'));
      console.log(chalk.gray('-'.repeat(80)));

      for (const batch of batches) {
        const idStr = batch.id.substring(0, 38).padEnd(40);
        const nameStr = batch.name.substring(0, 28).padEnd(30);
        console.log(`  ${idStr}${nameStr}${chalk.cyan(batch.testCaseCount)}`);
      }

      console.log(chalk.green(`\n共 ${batches.length} 个批次\n`));

    } catch (error) {
      console.error(chalk.red('\n❌ 列出批次失败：'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('list-results')
  .description('列出已保存的验收结果')
  .option('-d, --data-dir <dir>', '数据目录', './data')
  .action(async (options) => {
    try {
      const storage = createStorageManager({
        baseDirectory: options.dataDir
      });

      const results = await storage.listResults();

      if (results.length === 0) {
        console.log(chalk.yellow('\n📭 没有找到已保存的结果\n'));
        return;
      }

      console.log(chalk.blue('\n📊 已保存的验收结果：\n'));
      console.log(
        chalk.bold('  ID'.padEnd(40)) +
        chalk.bold('状态'.padEnd(10)) +
        chalk.bold('通过/总数'.padEnd(12)) +
        chalk.bold('完成时间')
      );
      console.log(chalk.gray('-'.repeat(90)));

      for (const result of results) {
        const idStr = result.id.substring(0, 38).padEnd(40);
        const statusColor = result.overallStatus === 'passed' ? chalk.green : chalk.red;
        const statusStr = statusColor(result.overallStatus.padEnd(10));
        const countStr = chalk.cyan(`${result.passed}/${result.total}`.padEnd(12));
        const timeStr = new Date(result.completedAt).toLocaleString('zh-CN');

        console.log(`  ${idStr}${statusStr}${countStr}${timeStr}`);
      }

      console.log(chalk.green(`\n共 ${results.length} 个结果\n`));

    } catch (error) {
      console.error(chalk.red('\n❌ 列出结果失败：'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('export-report')
  .description('导出验收报告')
  .argument('<resultId>', '验收结果 ID')
  .option('-d, --data-dir <dir>', '数据目录', './data')
  .option('-o, --output <file>', '输出文件路径', './report.md')
  .option('-f, --format <format>', '输出格式 (md|json|zip)', 'md')
  .action(async (resultId: string, options) => {
    try {
      console.log(chalk.blue('\n📄 导出验收报告...\n'));

      const storage = createStorageManager({
        baseDirectory: options.dataDir
      });

      const result = await storage.loadResult(resultId);
      const review = await storage.loadReviewByResultId(resultId);

      const exporter = createExporter();

      let outputPath = options.output;

      if (options.format === 'md') {
        await exporter.saveMarkdownReport(outputPath, result, review);
        console.log(chalk.green(`✅ Markdown报告已保存: ${outputPath}`));
      } else if (options.format === 'json') {
        if (!outputPath.endsWith('.json')) {
          outputPath = outputPath.replace(/\.[^.]+$/, '') + '.json';
        }
        const auditPackage = exporter.createAuditPackage(result, undefined, review);
        await fs.writeJson(outputPath, auditPackage, { spaces: 2 });
        console.log(chalk.green(`✅ JSON审计包已保存: ${outputPath}`));
      } else if (options.format === 'zip') {
        if (!outputPath.endsWith('.zip')) {
          outputPath = outputPath.replace(/\.[^.]+$/, '') + '.zip';
        }
        await exporter.saveAuditPackage(outputPath, result, undefined, review);
        console.log(chalk.green(`✅ ZIP审计包已保存: ${outputPath}`));
      }

      console.log(chalk.green('\n✅ 导出完成！\n'));

    } catch (error) {
      console.error(chalk.red('\n❌ 导出失败：'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('create-batch')
  .description('创建新的测试批次模板')
  .argument('<name>', '批次名称')
  .option('-p, --plugin-id <id>', '插件 ID')
  .option('-v, --plugin-version <version>', '插件版本', '1.0.0')
  .option('-o, --output <file>', '输出文件')
  .option('-e, --examples', '包含示例测试用例', true)
  .action(async (name: string, options) => {
    try {
      console.log(chalk.blue('\n📝 创建测试批次模板...\n'));

      const batch: TestBatch = {
        id: `batch-${Date.now()}`,
        name,
        description: '',
        pluginId: options.pluginId || 'plugin-id',
        pluginVersion: options.pluginVersion,
        createdAt: Date.now(),
        testCases: options.examples ? [
          {
            id: 'test-case-001',
            name: '示例测试用例 1',
            description: '请修改此测试用例',
            input: {
              format: 'json',
              data: {
                key: 'value'
              }
            },
            tags: ['example'],
            metadata: {}
          }
        ] : [],
        metadata: {}
      };

      const outputPath = options.output || `./${batch.id}.json`;
      await fs.writeJson(outputPath, batch, { spaces: 2 });

      console.log(chalk.green(`✅ 批次模板已创建: ${outputPath}`));
      console.log(chalk.gray('\n请编辑此文件添加测试用例。\n'));

    } catch (error) {
      console.error(chalk.red('\n❌ 创建批次失败：'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      process.exit(1);
    }
  });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
