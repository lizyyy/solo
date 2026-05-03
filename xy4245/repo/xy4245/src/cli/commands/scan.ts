import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { HtmlParser } from '../../parser/html-parser';
import { TrajectoryParser } from '../../parser/trajectory-parser';
import { OperationsParser } from '../../parser/operations-parser';
import { ScanResult, CriticalOperation } from '../../types';

export const scanCommand = new Command('scan')
  .description('解析页面快照、Tab 轨迹和操作清单')
  .option('-s, --snapshot <path>', 'HTML 快照路径', 'snapshot.html')
  .option('-t, --trajectory <path>', '轨迹 JSON 路径', 'trajectory.json')
  .option('-o, --operations <path>', '操作清单路径', 'operations.json')
  .option('-c, --config <path>', '配置文件路径', 'foi.config.json')
  .option('--output <path>', '输出目录', '.foi-output')
  .action(async (options: {
    snapshot: string;
    trajectory: string;
    operations: string;
    config: string;
    output: string;
  }) => {
    console.log(chalk.blue('焦点顺序体检员 - 扫描分析'));
    console.log('='.repeat(50));

    try {
      const config = loadConfig(options.config);
      
      const htmlPath = path.resolve(options.snapshot);
      const trajectoryPath = path.resolve(options.trajectory);
      const operationsPath = path.resolve(options.operations);
      const outputDir = path.resolve(options.output);

      if (!fs.existsSync(htmlPath)) {
        throw new Error(`找不到 HTML 快照: ${htmlPath}`);
      }

      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      const htmlParser = new HtmlParser(htmlContent);
      const focusableElements = htmlParser.getFocusableElements();
      
      console.log(chalk.green(`[✓] 解析 HTML 快照完成`));
      console.log(`    可聚焦元素: ${focusableElements.length} 个`);

      let trajectory = null;
      if (fs.existsSync(trajectoryPath)) {
        const trajectoryContent = fs.readFileSync(trajectoryPath, 'utf-8');
        const trajectoryParser = new TrajectoryParser();
        trajectory = trajectoryParser.parse(trajectoryContent);
        console.log(chalk.green(`[✓] 解析 Tab 轨迹完成`));
        console.log(`    轨迹点: ${trajectory.items.length} 个`);
      } else {
        console.log(chalk.yellow(`[!] 未找到轨迹文件: ${trajectoryPath}`));
      }

      let operations: CriticalOperation[] = [];
      if (fs.existsSync(operationsPath)) {
        const operationsContent = fs.readFileSync(operationsPath, 'utf-8');
        const operationsParser = new OperationsParser();
        operations = operationsParser.parse(operationsContent);
        console.log(chalk.green(`[✓] 解析操作清单完成`));
        console.log(`    操作项: ${operations.length} 个`);
      } else {
        console.log(chalk.yellow(`[!] 未找到操作清单: ${operationsPath}`));
      }

      const scanResult: ScanResult = {
        snapshotId: `snapshot-${Date.now()}`,
        timestamp: new Date().toISOString(),
        pageTitle: htmlParser.getPageTitle(),
        pageUrl: htmlParser.getPageUrl() || (trajectory?.pageUrl || 'unknown'),
        focusableElements,
        trajectory,
        criticalOperations: operations
      };

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const scanResultPath = path.join(outputDir, 'scan-result.json');
      fs.writeFileSync(scanResultPath, JSON.stringify(scanResult, null, 2));
      
      console.log('\n' + '='.repeat(50));
      console.log(chalk.green('扫描完成！'));
      console.log(`结果已保存至: ${scanResultPath}`);
      
      printScanSummary(scanResult);

    } catch (error) {
      console.error(chalk.red(`错误: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function loadConfig(configPath: string): any {
  const resolvedPath = path.resolve(configPath);
  if (fs.existsSync(resolvedPath)) {
    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
  return {};
}

function printScanSummary(result: ScanResult): void {
  console.log('\n扫描摘要:');
  console.log(`  页面标题: ${result.pageTitle}`);
  console.log(`  页面 URL: ${result.pageUrl}`);
  console.log(`  快照 ID: ${result.snapshotId}`);
  
  const visibleElements = result.focusableElements.filter(e => e.visible && !e.ariaHidden);
  const hiddenElements = result.focusableElements.filter(e => !e.visible || e.ariaHidden);
  const tabindexElements = result.focusableElements.filter(e => e.tabindex !== null);
  
  console.log(`\n  可聚焦元素统计:`);
  console.log(`    总数: ${result.focusableElements.length}`);
  console.log(`    可见元素: ${visibleElements.length}`);
  console.log(`    隐藏/aria-hidden: ${hiddenElements.length}`);
  console.log(`    带 tabindex: ${tabindexElements.length}`);

  if (result.trajectory) {
    console.log(`\n  Tab 轨迹统计:`);
    console.log(`    轨迹点数: ${result.trajectory.items.length}`);
    console.log(`    浏览器: ${result.trajectory.metadata.browser}`);
    console.log(`    视口: ${result.trajectory.metadata.viewport.width}x${result.trajectory.metadata.viewport.height}`);
  }

  if (result.criticalOperations.length > 0) {
    console.log(`\n  关键操作统计:`);
    console.log(`    操作项数: ${result.criticalOperations.length}`);
    const requiredCount = result.criticalOperations.filter(o => o.required).length;
    console.log(`    必填操作: ${requiredCount}`);
  }
}
