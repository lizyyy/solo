import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SQLiteStorage } from '../../storage/SQLiteStorage';
import { ClusterConfig, Event, Policy } from '../../types';

export const replayCommand = new Command('replay')
  .description('重放事件并模拟分布式一致性场景')
  .option('-c, --cluster <path>', '集群配置文件路径', './simulation/cluster.yaml')
  .option('-e, --events <path>', '事件序列文件路径', './simulation/events.jsonl')
  .option('-p, --policy <path>', '策略配置文件路径', './simulation/policy.yaml')
  .option('-o, --output <path>', '输出 SQLite 数据库路径', './simulation/results.sqlite')
  .option('--seed <seed>', '随机种子', Math.floor(Math.random() * 1000000).toString())
  .option('--verbose', '详细输出模式', false)
  .action(async (options) => {
    console.log('开始模拟分布式一致性场景...');
    console.log(`集群配置: ${options.cluster}`);
    console.log(`事件文件: ${options.events}`);
    console.log(`策略配置: ${options.policy}`);
    console.log(`输出数据库: ${options.output}`);
    console.log(`随机种子: ${options.seed}`);

    try {
      // 读取配置文件
      const clusterConfig = readClusterConfig(options.cluster);
      const events = readEvents(options.events);
      const policy = readPolicy(options.policy);

      console.log(`集群配置: ${clusterConfig.name}, 节点数: ${clusterConfig.nodes.length}`);
      console.log(`一致性模型: ${clusterConfig.consistencyModel}`);
      console.log(`事件数量: ${events.length}`);

      // 初始化存储
      const storage = new SQLiteStorage(options.output);
      await storage.initialize();

      // 创建模拟引擎
      const engine = new SimulationEngine(clusterConfig, policy, parseInt(options.seed), storage);

      // 执行模拟
      console.log('开始执行模拟...');
      const result = engine.run(events);

      console.log('\n模拟完成！');
      console.log(`模拟ID: ${result.id}`);
      console.log(`开始时间: ${new Date(result.startTime).toISOString()}`);
      console.log(`结束时间: ${new Date(result.endTime).toISOString()}`);
      console.log(`持续时间: ${(result.endTime - result.startTime) / 1000} 秒`);

      // 输出关键指标
      console.log('\n=== 关键指标 ===');
      console.log(`提交路径: ${result.metrics.commitPath.join(' → ')}`);
      console.log(`不可用窗口数量: ${result.metrics.unavailableWindow.length}`);
      if (result.metrics.unavailableWindow.length > 0) {
        result.metrics.unavailableWindow.forEach((w, i) => {
          console.log(`  ${i + 1}. 原因: ${w.cause}, 持续: ${w.duration}ms`);
        });
      }
      console.log(`冲突数量: ${result.metrics.conflicts.length}`);
      if (result.metrics.conflicts.length > 0) {
        result.metrics.conflicts.forEach((c, i) => {
          console.log(`  ${i + 1}. 节点 ${c.nodeId}: ${c.reason}`);
        });
      }
      console.log(`风险提示数量: ${result.metrics.risks.length}`);
      if (result.metrics.risks.length > 0) {
        result.metrics.risks.forEach((r, i) => {
          console.log(`  ${i + 1}. [${r.severity.toUpperCase()}] ${r.type}: ${r.description}`);
        });
      }

      // 输出详细信息
      if (options.verbose) {
        console.log('\n=== 节点状态 ===');
        result.nodes.forEach(node => {
          console.log(`  ${node.id} (${node.name}): ${node.status}${node.role ? `, 角色: ${node.role}` : ''}`);
        });

        console.log('\n=== 事件序列 ===');
        result.events.forEach((e, i) => {
          console.log(`  ${i + 1}. [${e.timestamp}ms] ${e.type} - ${e.description}`);
        });
      }

      // 保存结果
      storage.saveSimulationResult(result);
      console.log(`\n结果已保存到: ${options.output}`);
      console.log('使用 "dcs export" 命令可以导出详细报告');

    } catch (error: any) {
      console.error('模拟执行失败:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

function readClusterConfig(pathStr: string): ClusterConfig {
  if (!fs.existsSync(pathStr)) {
    throw new Error(`集群配置文件不存在: ${pathStr}`);
  }
  const content = fs.readFileSync(pathStr, 'utf-8');
  return yaml.parse(content) as ClusterConfig;
}

function readEvents(pathStr: string): Event[] {
  if (!fs.existsSync(pathStr)) {
    throw new Error(`事件文件不存在: ${pathStr}`);
  }
  const content = fs.readFileSync(pathStr, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as Event;
    } catch (error) {
      throw new Error(`事件文件格式错误，第 ${index + 1} 行: ${line}`);
    }
  });
}

function readPolicy(pathStr: string): Policy {
  if (!fs.existsSync(pathStr)) {
    throw new Error(`策略配置文件不存在: ${pathStr}`);
  }
  const content = fs.readFileSync(pathStr, 'utf-8');
  return yaml.parse(content) as Policy;
}
