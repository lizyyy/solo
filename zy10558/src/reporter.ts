import * as fs from 'fs';
import chalk from 'chalk';
import { ClusterResult, Cluster } from './types';

export function printConsoleSummary(result: ClusterResult, verbose: boolean = false): void {
  console.log('\n');
  console.log(chalk.bold.blue('='.repeat(60)));
  console.log(chalk.bold.blue('           测试失败聚类摘要'));
  console.log(chalk.bold.blue('='.repeat(60)));
  console.log('');
  
  console.log(chalk.bold('📊 概览统计'));
  console.log(`  总失败数: ${chalk.yellow(result.totalFailures)}`);
  console.log(`  聚类数量: ${chalk.cyan(result.totalClusters)}`);
  
  if (result.baseline) {
    console.log(`  新增错误: ${chalk.red(result.newFailures)}`);
    console.log(`  已有错误: ${chalk.green(result.existingFailures)}`);
  }
  
  console.log('');
  
  if (result.clusters.length > 0) {
    console.log(chalk.bold('🎯 聚类详情'));
    console.log('');
    
    for (let i = 0; i < result.clusters.length; i++) {
      const cluster = result.clusters[i];
      const prefix = cluster.isNew ? chalk.red('[新增] ') : '';
      
      console.log(`${chalk.dim(`${i + 1}.`)} ${prefix}${chalk.bold(cluster.label)}`);
      console.log(`    ${chalk.dim('数量:')} ${cluster.frequency} 次`);
      console.log(`    ${chalk.dim('代表:')} ${cluster.representative.original.testName}`);
      console.log(`    ${chalk.dim('错误:')} ${cluster.representative.original.errorMessage.slice(0, 80)}${cluster.representative.original.errorMessage.length > 80 ? '...' : ''}`);
      
      if (verbose && cluster.failures.length > 1) {
        console.log(`    ${chalk.dim('相关:')}`);
        for (let j = 1; j < Math.min(3, cluster.failures.length); j++) {
          console.log(`      - ${cluster.failures[j].original.testName}`);
        }
        if (cluster.failures.length > 3) {
          console.log(`      ... 还有 ${cluster.failures.length - 3} 个`);
        }
      }
      console.log('');
    }
  }
  
  if (result.parseErrors.length > 0) {
    console.log(chalk.bold.yellow('⚠️  解析异常'));
    console.log(`  共 ${result.parseErrors.length} 行未能正确解析:`);
    console.log('');
    
    for (const error of result.parseErrors.slice(0, 5)) {
      console.log(`  ${chalk.dim(`行 ${error.line}:`)} ${chalk.yellow(error.reason)}`);
      if (verbose) {
        console.log(`    ${chalk.dim(error.content.slice(0, 100))}`);
      }
    }
    
    if (result.parseErrors.length > 5) {
      console.log(`  ... 还有 ${result.parseErrors.length - 5} 个异常`);
    }
    console.log('');
  }
  
  console.log(chalk.dim(`生成时间: ${result.generatedAt}`));
  console.log('');
}

export function writeJsonReport(result: ClusterResult, filePath: string): void {
  const output = {
    ...result,
    clusters: result.clusters.map(cluster => ({
      id: cluster.id,
      label: cluster.label,
      frequency: cluster.frequency,
      isNew: cluster.isNew,
      fingerprint: cluster.representative.fingerprint,
      representative: {
        testName: cluster.representative.original.testName,
        errorMessage: cluster.representative.original.errorMessage,
        features: cluster.representative.features
      },
      failures: cluster.failures.map(f => ({
        testName: f.original.testName,
        errorMessage: f.original.errorMessage,
        fingerprint: f.fingerprint,
        sourceLine: f.original.sourceLine
      }))
    }))
  };
  
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');
}

export function writeMarkdownReport(result: ClusterResult, filePath: string): void {
  const lines: string[] = [];
  
  lines.push('# 测试失败聚类报告');
  lines.push('');
  lines.push(`> 生成时间: ${result.generatedAt}`);
  lines.push('');
  
  lines.push('## 📊 概览统计');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总失败数 | ${result.totalFailures} |`);
  lines.push(`| 聚类数量 | ${result.totalClusters} |`);
  if (result.baseline) {
    lines.push(`| 新增错误 | ${result.newFailures} 🔴 |`);
    lines.push(`| 已有错误 | ${result.existingFailures} 🟢 |`);
  }
  lines.push('');
  
  if (result.newFailures > 0) {
    lines.push('## 🔴 新增错误');
    lines.push('');
    
    const newClusters = result.clusters.filter(c => c.isNew);
    for (const cluster of newClusters) {
      lines.push(`### ${cluster.label}`);
      lines.push('');
      lines.push(`- **出现次数**: ${cluster.frequency} 次`);
      lines.push(`- **代表用例**: \`${cluster.representative.original.testName}\``);
      lines.push(`- **错误信息**: ${cluster.representative.original.errorMessage}`);
      lines.push('');
      
      if (cluster.failures.length > 1) {
        lines.push('**关联失败:**');
        lines.push('');
        for (const f of cluster.failures) {
          lines.push(`- \`${f.original.testName}\``);
        }
        lines.push('');
      }
    }
  }
  
  lines.push('## 🎯 错误聚类');
  lines.push('');
  
  for (let i = 0; i < result.clusters.length; i++) {
    const cluster = result.clusters[i];
    const badge = cluster.isNew ? '🆕 ' : '';
    
    lines.push(`### ${badge}${i + 1}. ${cluster.label} (${cluster.frequency} 次)`);
    lines.push('');
    lines.push(`**代表错误**: \`${cluster.representative.original.testName}\``);
    lines.push('');
    lines.push('```');
    lines.push(cluster.representative.original.errorMessage);
    lines.push('```');
    lines.push('');
  }
  
  if (result.parseErrors.length > 0) {
    lines.push('## ⚠️ 解析异常');
    lines.push('');
    lines.push('以下条目未能正确解析，请检查原始日志格式：');
    lines.push('');
    
    for (const error of result.parseErrors) {
      lines.push(`- **行 ${error.line}**: ${error.reason}`);
      lines.push('  ```');
      lines.push(`  ${error.content.slice(0, 200)}`);
      lines.push('  ```');
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('*此报告由 Test Failure Cluster CLI 自动生成*');
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
