import chalk from 'chalk';
import { table } from 'table';

export function generateTerminalReport(detectionResult, parseErrors, k8sErrors) {
  const { summary, driftResults, unmatched, grouped } = detectionResult;
  const lines = [];
  
  lines.push('');
  lines.push(chalk.bold.cyan('═══════════════════════════════════════════════════'));
  lines.push(chalk.bold.cyan('         K8s 镜像标签漂移检测报告'));
  lines.push(chalk.bold.cyan('═══════════════════════════════════════════════════'));
  lines.push('');
  lines.push(`检测时间: ${chalk.gray(new Date().toLocaleString('zh-CN'))}`);
  lines.push('');
  
  lines.push(chalk.bold('📊 概要统计'));
  lines.push(chalk.gray('─────────────────────────────────────────'));
  
  const summaryData = [
    [chalk.bold('指标'), chalk.bold('数值'), chalk.bold('说明')],
    ['总计检查', summary.totalChecked.toString(), '容器镜像'],
    [chalk.green('匹配'), chalk.green(summary.matched.toString()), '一致的镜像'],
    [chalk.red('漂移'), chalk.red(summary.drifted.toString()), '发生漂移的镜像'],
    [chalk.yellow('警告'), chalk.yellow(summary.warning.toString()), '存在警告的镜像'],
    ['漂移率', `${summary.driftRate}%`, '漂移镜像占比']
  ];
  
  lines.push(table(summaryData, {
    border: {
      topBody: `─`,
      topJoin: `┬`,
      topLeft: `┌`,
      topRight: `┐`,
      bottomBody: `─`,
      bottomJoin: `┴`,
      bottomLeft: `└`,
      bottomRight: `┘`,
      bodyLeft: `│`,
      bodyRight: `│`,
      bodyJoin: `│`,
      joinBody: `─`,
      joinLeft: `├`,
      joinRight: `┤`,
      joinJoin: `┼`
    },
    columns: [{ width: 12 }, { width: 10 }, { width: 18 }]
  }));
  
  lines.push('');
  lines.push(chalk.bold('🚨 漂移类型分布'));
  lines.push(chalk.gray('─────────────────────────────────────────'));
  
  for (const [type, count] of Object.entries(summary.driftTypes)) {
    const bar = '█'.repeat(Math.min(count * 2, 20));
    lines.push(`  ${chalk.red(type)}: ${bar} ${count}`);
  }
  
  lines.push('');
  
  if (summary.drifted > 0) {
    lines.push(chalk.bold('⚠️  漂移详情'));
    lines.push(chalk.gray('─────────────────────────────────────────'));
    lines.push('');
    
    const drifted = driftResults.filter(r => r.status === 'DRIFTED');
    
    for (const result of drifted) {
      const { expected, actual, issues } = result;
      
      lines.push(chalk.red.bold(`❌ ${expected.namespace}/${expected.kind}/${expected.name}`));
      lines.push(`   容器: ${expected.containerName} (${expected.containerType})`);
      lines.push('');
      lines.push(`   ${chalk.blue('期望:')} ${expected.image}`);
      lines.push(`   ${chalk.magenta('实际:')} ${actual.specImage}`);
      if (actual.actualDigest) {
        lines.push(`   ${chalk.magenta('Digest:')} ${actual.actualDigest}`);
      }
      lines.push('');
      
      for (const issue of issues) {
        const severityColor = issue.severity === 'high' ? chalk.red : 
                              issue.severity === 'medium' ? chalk.yellow : chalk.blue;
        lines.push(`   ${severityColor('⚠ ' + issue.type)}: ${issue.message}`);
        if (issue.expected || issue.actual) {
          lines.push(`       ${chalk.gray('期望:')} ${issue.expected || 'N/A'}`);
          lines.push(`       ${chalk.gray('实际:')} ${issue.actual || 'N/A'}`);
        }
      }
      
      lines.push('');
      lines.push(`   ${chalk.gray('📍 位置:')} ${expected.location.filePath}:${expected.location.line || '??'}`);
      if (expected.location.rawLine) {
        lines.push(`      ${chalk.dim(expected.location.rawLine.trim())}`);
      }
      lines.push(`   ${chalk.gray('🔗 Pod:')} ${actual.podName} (节点: ${actual.nodeName || 'unknown'})`);
      lines.push(chalk.gray('   ─────────────────────────────────────'));
      lines.push('');
    }
  }
  
  if (unmatched.expected.length > 0) {
    lines.push(chalk.bold('🔍 清单中但未运行的工作负载'));
    lines.push(chalk.gray('─────────────────────────────────────────'));
    
    for (const item of unmatched.expected) {
      lines.push(`  ${chalk.yellow('⚠')}  ${item.namespace}/${item.kind}/${item.name}`);
      lines.push(`     容器: ${item.containerName} - ${item.message}`);
    }
    lines.push('');
  }
  
  if (unmatched.actual.length > 0) {
    lines.push(chalk.bold('🔍 运行中但不在清单中的工作负载'));
    lines.push(chalk.gray('─────────────────────────────────────────'));
    
    for (const item of unmatched.actual) {
      lines.push(`  ${chalk.blue('ℹ')}  ${item.namespace}/${item.workloadKind}/${item.workload}`);
      lines.push(`     Pod: ${item.podName} - ${item.message}`);
    }
    lines.push('');
  }
  
  if (parseErrors.length > 0 || k8sErrors.length > 0) {
    lines.push(chalk.bold('❌ 解析错误'));
    lines.push(chalk.gray('─────────────────────────────────────────'));
    
    for (const err of parseErrors) {
      lines.push(`  ${chalk.red('✖')}  ${err.filePath}:${err.line || '??'} - ${err.message}`);
      if (err.raw) {
        lines.push(`      ${chalk.dim(err.raw)}`);
      }
    }
    
    for (const err of k8sErrors) {
      lines.push(`  ${chalk.red('✖')}  [K8s API] ${err.message}`);
    }
    lines.push('');
  }
  
  if (summary.drifted === 0 && parseErrors.length === 0 && k8sErrors.length === 0) {
    lines.push(chalk.green.bold('✅ 所有镜像检查通过，未发现漂移!'));
    lines.push('');
  }
  
  return lines.join('\n');
}

export function generateJsonReport(detectionResult, parseErrors, k8sErrors) {
  return JSON.stringify({
    version: '1.0.0',
    generatedAt: detectionResult.timestamp,
    summary: detectionResult.summary,
    driftResults: detectionResult.driftResults,
    unmatched: detectionResult.unmatched,
    grouped: detectionResult.grouped,
    errors: {
      parseErrors,
      k8sErrors
    }
  }, null, 2);
}

export function generateMarkdownReport(detectionResult, parseErrors, k8sErrors) {
  const { summary, driftResults, unmatched } = detectionResult;
  const lines = [];
  
  lines.push('# K8s 镜像标签漂移检测报告');
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  
  lines.push('## 📊 概要统计');
  lines.push('');
  lines.push('| 指标 | 数值 | 说明 |');
  lines.push('|------|------|------|');
  lines.push(`| 总计检查 | ${summary.totalChecked} | 容器镜像 |`);
  lines.push(`| ✅ 匹配 | ${summary.matched} | 一致的镜像 |`);
  lines.push(`| ❌ 漂移 | ${summary.drifted} | 发生漂移的镜像 |`);
  lines.push(`| ⚠️ 警告 | ${summary.warning} | 存在警告的镜像 |`);
  lines.push(`| 漂移率 | ${summary.driftRate}% | 漂移镜像占比 |`);
  lines.push('');
  
  if (Object.keys(summary.driftTypes).length > 0) {
    lines.push('## 🚨 漂移类型分布');
    lines.push('');
    lines.push('| 漂移类型 | 数量 |');
    lines.push('|----------|------|');
    
    for (const [type, count] of Object.entries(summary.driftTypes)) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push('');
  }
  
  if (summary.drifted > 0) {
    lines.push('## ⚠️ 漂移详情');
    lines.push('');
    
    const drifted = driftResults.filter(r => r.status === 'DRIFTED');
    
    for (const result of drifted) {
      const { expected, actual, issues } = result;
      
      lines.push(`### ❌ ${expected.namespace}/${expected.kind}/${expected.name}`);
      lines.push('');
      lines.push(`| 项目 | 内容 |`);
      lines.push(`|------|------|`);
      lines.push(`| 容器 | ${expected.containerName} (${expected.containerType}) |`);
      lines.push(`| 期望镜像 | \`${expected.image}\` |`);
      lines.push(`| 实际镜像 | \`${actual.specImage}\` |`);
      lines.push(`| 实际 Digest | \`${actual.actualDigest || 'N/A'}\` |`);
      lines.push(`| Pod 名称 | ${actual.podName} |`);
      lines.push(`| 节点 | ${actual.nodeName || 'unknown'} |`);
      lines.push(`| 文件位置 | \`${expected.location.filePath}:${expected.location.line || '??'}\` |`);
      lines.push('');
      
      lines.push('#### 发现的问题');
      lines.push('');
      
      for (const issue of issues) {
        const severity = issue.severity === 'high' ? '🔴' : 
                        issue.severity === 'medium' ? '🟡' : '🔵';
        lines.push(`- ${severity} **${issue.type}**: ${issue.message}`);
        if (issue.expected || issue.actual) {
          lines.push(`  - 期望: \`${issue.expected || 'N/A'}\``);
          lines.push(`  - 实际: \`${issue.actual || 'N/A'}\``);
        }
      }
      lines.push('');
      
      if (expected.location.rawLine) {
        lines.push('#### 原始代码');
        lines.push('```yaml');
        lines.push(expected.location.rawLine.trim());
        lines.push('```');
        lines.push('');
      }
      
      lines.push('---');
      lines.push('');
    }
  }
  
  if (unmatched.expected.length > 0) {
    lines.push('## 🔍 清单中但未运行的工作负载');
    lines.push('');
    lines.push('| 命名空间 | 类型 | 名称 | 容器 | 说明 |');
    lines.push('|----------|------|------|------|------|');
    
    for (const item of unmatched.expected) {
      lines.push(`| ${item.namespace} | ${item.kind} | ${item.name} | ${item.containerName} | ${item.message} |`);
    }
    lines.push('');
  }
  
  if (unmatched.actual.length > 0) {
    lines.push('## 🔍 运行中但不在清单中的工作负载');
    lines.push('');
    lines.push('| 命名空间 | 类型 | 名称 | Pod | 说明 |');
    lines.push('|----------|------|------|-----|------|');
    
    for (const item of unmatched.actual) {
      lines.push(`| ${item.namespace} | ${item.workloadKind} | ${item.workload} | ${item.podName} | ${item.message} |`);
    }
    lines.push('');
  }
  
  if (parseErrors.length > 0 || k8sErrors.length > 0) {
    lines.push('## ❌ 错误信息');
    lines.push('');
    
    if (parseErrors.length > 0) {
      lines.push('### YAML 解析错误');
      lines.push('');
      
      for (const err of parseErrors) {
        lines.push(`- \`${err.filePath}:${err.line || '??'}\`: ${err.message}`);
      }
      lines.push('');
    }
    
    if (k8sErrors.length > 0) {
      lines.push('### K8s API 错误');
      lines.push('');
      
      for (const err of k8sErrors) {
        lines.push(`- ${err.message}`);
      }
      lines.push('');
    }
  }
  
  if (summary.drifted === 0 && parseErrors.length === 0 && k8sErrors.length === 0) {
    lines.push('## ✅ 检查通过');
    lines.push('');
    lines.push('所有镜像检查通过，未发现漂移! 🎉');
    lines.push('');
  }
  
  return lines.join('\n');
}

export function saveReport(content, filePath) {
  const fs = require('fs');
  const path = require('path');
  
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
}