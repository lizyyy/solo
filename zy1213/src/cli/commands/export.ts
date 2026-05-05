import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteStorage } from '../../storage/SQLiteStorage';
import { SimulationResult } from '../../types';

export const exportCommand = new Command('export')
  .description('导出模拟运行结果为 Markdown 或 JSON 报告')
  .option('-d, --database <path>', 'SQLite 数据库路径', './simulation/results.sqlite')
  .option('-r, --run <id>', '指定运行的 ID (默认为最近一次)')
  .option('-o, --output <path>', '输出文件路径', './simulation/report.md')
  .option('-f, --format <format>', '输出格式: md, json, both', 'md')
  .option('--verbose', '详细输出模式', false)
  .action(async (options) => {
    console.log('开始导出模拟结果报告...');
    console.log(`数据库: ${options.database}`);
    console.log(`输出路径: ${options.output}`);
    console.log(`格式: ${options.format}`);

    try {
      // 初始化存储
      const storage = new SQLiteStorage(options.database);
      storage.initialize();

      // 获取运行结果
      let result: SimulationResult;
      if (options.run) {
        const r = storage.getSimulationResult(options.run);
        if (!r) throw new Error(`未找到运行结果: ${options.run}`);
        result = r;
        console.log(`使用指定运行: ${options.run}`);
      } else {
        const allResults = storage.getAllSimulationResults();
        if (allResults.length === 0) {
          throw new Error('数据库中没有运行结果');
        }
        result = allResults[allResults.length - 1];
        console.log(`使用最近一次运行: ${result.id}`);
      }

      // 生成报告
      const mdReport = generateMarkdownReport(result);
      const jsonReport = generateJSONReport(result);

      // 输出文件
      const basePath = options.output;
      const baseDir = path.dirname(basePath);
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }

      if (options.format === 'md' || options.format === 'both') {
        const mdPath = basePath.endsWith('.md') ? basePath : basePath + '.md';
        fs.writeFileSync(mdPath, mdReport);
        console.log(`Markdown 报告已保存到: ${mdPath}`);
      }

      if (options.format === 'json' || options.format === 'both') {
        const jsonPath = basePath.endsWith('.json') ? basePath : basePath + '.json';
        fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
        console.log(`JSON 报告已保存到: ${jsonPath}`);
      }

      console.log('\n导出完成！');

    } catch (error: any) {
      console.error('导出失败:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

function generateMarkdownReport(result: SimulationResult): string {
  let report = '# 分布式一致性模拟报告\n\n';
  report += `生成时间: ${new Date().toISOString()}\n\n`;

  report += '## 概览\n\n';
  report += `| 项目 | 内容 |\n`;
  report += `|------|------|\n`;
  report += `| 模拟ID | ${result.id} |\n`;
  report += `| 随机种子 | ${result.seed} |\n`;
  report += `| 一致性模型 | ${result.consistencyModel} |\n`;
  report += `| 开始时间 | ${new Date(result.startTime).toISOString()} |\n`;
  report += `| 结束时间 | ${new Date(result.endTime).toISOString()} |\n`;
  report += `| 持续时间 | ${(result.endTime - result.startTime) / 1000} 秒 |\n`;
  report += `| 事件数量 | ${result.events.length} |\n\n`;

  report += '## 集群状态\n\n';
  report += `| 节点ID | 名称 | 状态 | 角色 | 任期 |\n`;
  report += `|--------|------|------|------|------|\n`;
  result.nodes.forEach(node => {
    report += `| ${node.id} | ${node.name} | ${node.status} | ${node.role || '-'} | ${node.term || '-'} |\n`;
  });
  report += '\n';

  report += '## 关键指标\n\n';
  
  report += '### 提交路径\n\n';
  report += `\`\`\`\n${result.metrics.commitPath.join(' → ')}\n\`\`\`\n\n`;

  report += '### 不可用窗口\n\n';
  if (result.metrics.unavailableWindow.length > 0) {
    report += `| 序号 | 开始时间 | 结束时间 | 持续时间 | 原因 |\n`;
    report += `|------|----------|----------|----------|------|\n`;
    result.metrics.unavailableWindow.forEach((w, i) => {
      report += `| ${i + 1} | ${w.startTime}ms | ${w.endTime}ms | ${w.duration}ms | ${w.cause} |\n`;
    });
  } else {
    report += '无不可用窗口\n';
  }
  report += '\n';

  report += '### 冲突记录\n\n';
  if (result.metrics.conflicts.length > 0) {
    report += `| 序号 | 事件ID | 节点ID | 原因 | 时间 |\n`;
    report += `|------|--------|--------|------|------|\n`;
    result.metrics.conflicts.forEach((c, i) => {
      report += `| ${i + 1} | ${c.eventId} | ${c.nodeId} | ${c.reason} | ${c.timestamp}ms |\n`;
    });
  } else {
    report += '无冲突记录\n';
  }
  report += '\n';

  report += '### 风险提示\n\n';
  if (result.metrics.risks.length > 0) {
    report += `| 序号 | 类型 | 严重程度 | 描述 | 时间 |\n`;
    report += `|------|------|----------|------|------|\n`;
    result.metrics.risks.forEach((r, i) => {
      report += `| ${i + 1} | ${r.type} | ${r.severity.toUpperCase()} | ${r.description} | ${r.timestamp}ms |\n`;
    });
  } else {
    report += '无风险提示\n';
  }
  report += '\n';

  report += '### 性能指标\n\n';
  report += `| 指标 | 值 |\n`;
  report += `|------|-----|\n`;
  report += `| 平均延迟 | ${result.metrics.latency.average}ms |\n`;
  report += `| P95 延迟 | ${result.metrics.latency.p95}ms |\n`;
  report += `| P99 延迟 | ${result.metrics.latency.p99}ms |\n`;
  report += `| 读取吞吐量 | ${result.metrics.throughput.readsPerSecond} ops/s |\n`;
  report += `| 写入吞吐量 | ${result.metrics.throughput.writesPerSecond} ops/s |\n\n`;

  report += '## 事件序列\n\n';
  report += `| 序号 | 时间 | 类型 | 节点 | 目标节点 | 结果 | 描述 |\n`;
  report += `|------|------|------|------|----------|------|------|\n`;
  result.events.forEach((e, i) => {
    report += `| ${i + 1} | ${e.timestamp}ms | ${e.type} | ${e.nodeId} | ${e.targetNodeId || '-'} | ${e.result || '-'} | ${e.description} |\n`;
  });
  report += '\n';

  report += '## CAP 理论分析\n\n';
  report += '根据模拟结果，分析 CAP 三个特性在不同场景下的表现：\n\n';
  
  if (result.metrics.conflicts.length > 0) {
    report += '- **一致性 (Consistency)**: 检测到冲突，可能存在一致性问题。\n';
  } else {
    report += '- **一致性 (Consistency)**: 未检测到冲突，一致性保持良好。\n';
  }

  if (result.metrics.unavailableWindow.length > 0) {
    report += `- **可用性 (Availability)**: 存在 ${result.metrics.unavailableWindow.length} 个不可用窗口，可用性受到影响。\n`;
  } else {
    report += '- **可用性 (Availability)**: 无不可用窗口，可用性保持良好。\n';
  }

  report += '- **分区容错性 (Partition Tolerance)**: 网络分区场景已模拟，系统表现取决于一致性模型配置。\n\n';

  report += '## BASE 理论分析\n\n';
  report += '根据模拟结果，分析 BASE 三个特性的表现：\n\n';
  
  if (result.consistencyModel === 'eventual') {
    report += '- **基本可用 (Basically Available)**: 最终一致性模型下，系统在分区场景下仍可响应请求。\n';
    report += '- **软状态 (Soft State)**: 数据状态可能在无外部输入的情况下发生变化（如异步复制）。\n';
    report += '- **最终一致性 (Eventually Consistent)**: 系统将在一段时间后达到一致状态。\n';
  } else {
    report += '- **基本可用 (Basically Available)**: 强一致性模型下，分区可能导致部分节点不可用。\n';
    report += '- **软状态 (Soft State)**: 强一致性模型下通常不采用软状态。\n';
    report += '- **最终一致性 (Eventually Consistent)**: 当前配置为强一致性，不适用最终一致性。\n';
  }

  return report;
}

function generateJSONReport(result: SimulationResult) {
  return {
    reportInfo: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    },
    simulation: {
      id: result.id,
      seed: result.seed,
      consistencyModel: result.consistencyModel,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: result.endTime - result.startTime
    },
    nodes: result.nodes,
    metrics: {
      commitPath: result.metrics.commitPath,
      unavailableWindow: result.metrics.unavailableWindow,
      conflicts: result.metrics.conflicts,
      risks: result.metrics.risks,
      latency: result.metrics.latency,
      throughput: result.metrics.throughput
    },
    events: result.events,
    analysis: {
      cap: {
        consistency: result.metrics.conflicts.length === 0,
        availability: result.metrics.unavailableWindow.length === 0,
        partitionTolerance: true
      },
      base: {
        basicallyAvailable: result.consistencyModel === 'eventual',
        softState: result.consistencyModel === 'eventual',
        eventuallyConsistent: result.consistencyModel === 'eventual'
      }
    }
  };
}
