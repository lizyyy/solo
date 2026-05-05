import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteStorage } from '../../storage/SQLiteStorage';
import { SimulationResult } from '../../types';

export const compareCommand = new Command('compare')
  .description('比较两次模拟运行的结果')
  .option('-d, --database <path>', 'SQLite 数据库路径', './simulation/results.sqlite')
  .option('-1, --run1 <id>', '第一次运行的 ID')
  .option('-2, --run2 <id>', '第二次运行的 ID')
  .option('--all', '比较所有运行结果', false)
  .option('--output <path>', '比较报告输出路径', './simulation/comparison.md')
  .option('--verbose', '详细输出模式', false)
  .action(async (options) => {
    console.log('开始比较模拟运行结果...');
    console.log(`数据库: ${options.database}`);

    try {
      // 初始化存储
      const storage = new SQLiteStorage(options.database);
      storage.initialize();

      let results: SimulationResult[] = [];

      if (options.all) {
        results = storage.getAllSimulationResults();
        console.log(`找到 ${results.length} 次模拟运行`);
      } else if (options.run1 && options.run2) {
        const r1 = storage.getSimulationResult(options.run1);
        const r2 = storage.getSimulationResult(options.run2);
        if (!r1) throw new Error(`未找到运行结果: ${options.run1}`);
        if (!r2) throw new Error(`未找到运行结果: ${options.run2}`);
        results = [r1, r2];
      } else {
        // 获取最近的两次运行
        results = storage.getAllSimulationResults().slice(-2);
        if (results.length < 2) {
          throw new Error('数据库中至少需要两次运行结果才能比较');
        }
        console.log('使用最近的两次运行结果进行比较');
      }

      // 执行比较
      const comparison = compareResults(results);

      // 输出比较结果
      console.log('\n=== 比较结果 ===');
      console.log(`运行数量: ${results.length}`);
      
      results.forEach((r, i) => {
        console.log(`\n运行 ${i + 1}: ${r.id}`);
        console.log(`  开始时间: ${new Date(r.startTime).toISOString()}`);
        console.log(`  一致性模型: ${r.consistencyModel}`);
        console.log(`  事件数量: ${r.events.length}`);
        console.log(`  冲突数量: ${r.metrics.conflicts.length}`);
        console.log(`  风险数量: ${r.metrics.risks.length}`);
      });

      // 输出差异
      console.log('\n=== 差异分析 ===');
      console.log(`一致性模型差异: ${comparison.consistencyModels.length} 种`);
      console.log(`平均事件数: ${comparison.avgEvents.toFixed(1)}`);
      console.log(`平均冲突数: ${comparison.avgConflicts.toFixed(1)}`);
      console.log(`平均风险数: ${comparison.avgRisks.toFixed(1)}`);

      if (comparison.uniqueRisks.length > 0) {
        console.log('\n唯一风险类型:');
        comparison.uniqueRisks.forEach(r => {
          console.log(`  - ${r}`);
        });
      }

      // 生成报告
      const report = generateComparisonReport(results, comparison);
      fs.writeFileSync(options.output, report);
      console.log(`\n比较报告已保存到: ${options.output}`);

    } catch (error: any) {
      console.error('比较失败:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

interface Comparison {
  consistencyModels: string[];
  avgEvents: number;
  avgConflicts: number;
  avgRisks: number;
  uniqueRisks: string[];
  maxUnavailableWindow: number;
}

function compareResults(results: SimulationResult[]): Comparison {
  const consistencyModels = [...new Set(results.map(r => r.consistencyModel))];
  const avgEvents = results.reduce((sum, r) => sum + r.events.length, 0) / results.length;
  const avgConflicts = results.reduce((sum, r) => sum + r.metrics.conflicts.length, 0) / results.length;
  const avgRisks = results.reduce((sum, r) => sum + r.metrics.risks.length, 0) / results.length;

  const allRiskTypes = new Set<string>();
  results.forEach(r => {
    r.metrics.risks.forEach(ri => allRiskTypes.add(ri.type));
  });

  let maxUnavailableWindow = 0;
  results.forEach(r => {
    r.metrics.unavailableWindow.forEach(w => {
      if (w.duration > maxUnavailableWindow) {
        maxUnavailableWindow = w.duration;
      }
    });
  });

  return {
    consistencyModels,
    avgEvents,
    avgConflicts,
    avgRisks,
    uniqueRisks: [...allRiskTypes],
    maxUnavailableWindow
  };
}

function generateComparisonReport(results: SimulationResult[], comparison: Comparison): string {
  let report = '# 模拟运行比较报告\n\n';
  report += `生成时间: ${new Date().toISOString()}\n\n`;

  report += '## 概览\n\n';
  report += `| 指标 | 值 |\n`;
  report += `|------|-----|\n`;
  report += `| 运行数量 | ${results.length} |\n`;
  report += `| 一致性模型 | ${comparison.consistencyModels.join(', ')} |\n`;
  report += `| 平均事件数 | ${comparison.avgEvents.toFixed(1)} |\n`;
  report += `| 平均冲突数 | ${comparison.avgConflicts.toFixed(1)} |\n`;
  report += `| 平均风险数 | ${comparison.avgRisks.toFixed(1)} |\n`;
  report += `| 最大不可用窗口 | ${comparison.maxUnavailableWindow}ms |\n\n`;

  report += '## 各运行详情\n\n';
  results.forEach((r, i) => {
    report += `### 运行 ${i + 1}: ${r.id}\n\n`;
    report += `- 开始时间: ${new Date(r.startTime).toISOString()}\n`;
    report += `- 结束时间: ${new Date(r.endTime).toISOString()}\n`;
    report += `- 持续时间: ${(r.endTime - r.startTime) / 1000} 秒\n`;
    report += `- 一致性模型: ${r.consistencyModel}\n`;
    report += `- 随机种子: ${r.seed}\n\n`;

    report += '#### 节点状态\n\n';
    report += `| 节点ID | 名称 | 状态 | 角色 |\n`;
    report += `|--------|------|------|------|\n`;
    r.nodes.forEach(node => {
      report += `| ${node.id} | ${node.name} | ${node.status} | ${node.role || '-'} |\n`;
    });
    report += '\n';

    report += '#### 指标\n\n';
    report += `- 提交路径: ${r.metrics.commitPath.join(' → ')}\n`;
    report += `- 不可用窗口: ${r.metrics.unavailableWindow.length} 个\n`;
    if (r.metrics.unavailableWindow.length > 0) {
      r.metrics.unavailableWindow.forEach((w, j) => {
        report += `  - ${j + 1}. 原因: ${w.cause}, 持续: ${w.duration}ms\n`;
      });
    }
    report += `- 冲突数量: ${r.metrics.conflicts.length}\n`;
    if (r.metrics.conflicts.length > 0) {
      r.metrics.conflicts.forEach((c, j) => {
        report += `  - ${j + 1}. 节点 ${c.nodeId}: ${c.reason}\n`;
      });
    }
    report += `- 风险数量: ${r.metrics.risks.length}\n`;
    if (r.metrics.risks.length > 0) {
      r.metrics.risks.forEach((ri, j) => {
        report += `  - ${j + 1}. [${ri.severity.toUpperCase()}] ${ri.type}: ${ri.description}\n`;
      });
    }
    report += '\n';
  });

  report += '## 风险类型统计\n\n';
  if (comparison.uniqueRisks.length > 0) {
    comparison.uniqueRisks.forEach(rt => {
      const count = results.filter(r => r.metrics.risks.some(ri => ri.type === rt)).length;
      report += `- ${rt}: ${count} 次运行中出现\n`;
    });
  } else {
    report += '无风险记录\n';
  }

  return report;
}
