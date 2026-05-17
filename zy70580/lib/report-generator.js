const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { table } = require('table');

class ReportGenerator {
  constructor(analysisResult, options = {}) {
    this.result = analysisResult;
    this.options = options;
    this.outputDir = options.outputDir || process.cwd();
  }

  generateTerminalSummary() {
    const lines = [];
    const s = this.result.summary;

    lines.push('');
    lines.push(chalk.bold.blue('══════════════════════════════════════════════════════════════'));
    lines.push(chalk.bold.blue('                    K8s 探针策略分析报告'));
    lines.push(chalk.bold.blue('══════════════════════════════════════════════════════════════'));
    lines.push('');

    lines.push(chalk.bold('📊 分析概览'));
    lines.push(chalk.gray('──────────────────────────────────────────────────────────────'));
    lines.push(`  文件总数: ${s.totalFiles}`);
    lines.push(`  成功解析: ${s.successfulFiles}`);
    lines.push(`  工作负载数: ${s.totalDocuments}`);
    lines.push(`  容器总数: ${s.totalContainers}`);
    lines.push('');

    lines.push(chalk.bold('🔍 探针配置统计'));
    lines.push(chalk.gray('──────────────────────────────────────────────────────────────'));
    lines.push(`  LivenessProbe:  ${this.formatCount(s.containersWithLiveness, s.totalContainers)}`);
    lines.push(`  ReadinessProbe: ${this.formatCount(s.containersWithReadiness, s.totalContainers)}`);
    lines.push(`  StartupProbe:   ${this.formatCount(s.containersWithStartup, s.totalContainers)}`);
    lines.push('');

    if (s.issuesCount > 0 || s.warningsCount > 0) {
      lines.push(chalk.bold('⚠️  问题统计'));
      lines.push(chalk.gray('──────────────────────────────────────────────────────────────'));
      lines.push(`  ${chalk.red.bold('错误: ' + s.issuesCount)}`);
      lines.push(`  ${chalk.yellow.bold('警告: ' + s.warningsCount)}`);
      lines.push('');
    }

    const envGroups = Object.keys(this.result.environmentGroups);
    if (envGroups.length > 0) {
      lines.push(chalk.bold('🌍 环境分组'));
      lines.push(chalk.gray('──────────────────────────────────────────────────────────────'));
      for (const env of envGroups) {
        const count = this.result.environmentGroups[env].length;
        lines.push(`  ${env}: ${count} 个容器`);
      }
      lines.push('');
    }

    if (this.result.comparisons.length > 0) {
      lines.push(chalk.bold('⚖️  环境差异警告'));
      lines.push(chalk.gray('──────────────────────────────────────────────────────────────'));
      for (const comp of this.result.comparisons) {
        const color = comp.severity === 'error' ? chalk.red : chalk.yellow;
        lines.push(color(`  ${comp.message}`));
      }
      lines.push('');
    }

    if (this.result.issues.length > 0) {
      lines.push(chalk.bold('📋 问题详情'));
      lines.push(chalk.gray('──────────────────────────────────────────────────────────────'));
      
      const errors = this.result.issues.filter(i => i.severity === 'error');
      const warnings = this.result.issues.filter(i => i.severity === 'warning');

      if (errors.length > 0) {
        lines.push('');
        lines.push(chalk.red.bold('  错误:'));
        for (const issue of errors.slice(0, 10)) {
          lines.push(`    ✗ ${issue.message}`);
          lines.push(`      ${chalk.gray('位置: ' + issue.filePath + (issue.workloadName ? ' / ' + issue.workloadName : ''))}`);
        }
        if (errors.length > 10) {
          lines.push(`    ${chalk.gray(`... 还有 ${errors.length - 10} 个错误`)}`);
        }
      }

      if (warnings.length > 0) {
        lines.push('');
        lines.push(chalk.yellow.bold('  警告:'));
        for (const issue of warnings.slice(0, 10)) {
          lines.push(`    ! ${issue.message}`);
          lines.push(`      ${chalk.gray('位置: ' + issue.filePath + (issue.workloadName ? ' / ' + issue.workloadName : ''))}`);
        }
        if (warnings.length > 10) {
          lines.push(`    ${chalk.gray(`... 还有 ${warnings.length - 10} 个警告`)}`);
        }
      }
      lines.push('');
    }

    if (this.result.raw.errors && this.result.raw.errors.length > 0) {
      lines.push(chalk.bold.red('❌ 解析错误（坏行记录）'));
      lines.push(chalk.gray('──────────────────────────────────────────────────────────────'));
      for (const error of this.result.raw.errors.slice(0, 15)) {
        lines.push(`  ✗ ${chalk.red(error.message)}`);
        lines.push(`    ${chalk.gray('文件: ' + error.filePath)}`);
        if (error.line !== undefined) {
          lines.push(`    ${chalk.gray('行号: ' + (error.line + 1))}`);
        }
      }
      if (this.result.raw.errors.length > 15) {
        lines.push(`    ${chalk.gray(`... 还有 ${this.result.raw.errors.length - 15} 个错误`)}`);
      }
      lines.push('');
    }

    if (this.result.containers.length > 0) {
      lines.push(chalk.bold('📦 探针配置详情'));
      lines.push(chalk.gray('──────────────────────────────────────────────────────────────'));
      
      const tableData = [
        ['容器', '类型', 'initialDelay', 'period', 'timeout', 'failureThreshold']
      ];

      for (const container of this.result.containers.slice(0, 15)) {
        const probeTypes = ['liveness', 'readiness', 'startup'];
        let firstRow = true;
        
        for (const probeType of probeTypes) {
          const probe = container.probes[probeType];
          if (probe) {
            tableData.push([
              firstRow ? `${container.workloadName}/${container.name}` : '',
              probeType,
              probe.initialDelaySeconds + 's',
              probe.periodSeconds + 's',
              probe.timeoutSeconds + 's',
              probe.failureThreshold
            ]);
            firstRow = false;
          }
        }
      }

      if (tableData.length > 1) {
        lines.push(table(tableData, {
          columns: {
            0: { width: 25 },
            1: { width: 10 },
            2: { width: 12 },
            3: { width: 8 },
            4: { width: 8 },
            5: { width: 16 }
          }
        }));
      }

      if (this.result.containers.length > 15) {
        lines.push(chalk.gray(`  ... 还有 ${this.result.containers.length - 15} 个容器配置`));
      }
      lines.push('');
    }

    lines.push(chalk.bold.blue('══════════════════════════════════════════════════════════════'));
    lines.push('');

    return lines.join('\n');
  }

  formatCount(count, total) {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    const color = percent === 100 ? chalk.green : percent > 50 ? chalk.yellow : chalk.red;
    return color(`${count}/${total} (${percent}%)`);
  }

  generateJsonReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: this.result.summary,
      containers: this.result.containers.map(c => ({
        name: c.name,
        namespace: c.namespace,
        workloadName: c.workloadName,
        workloadKind: c.workloadKind,
        filePath: c.filePath,
        probes: {
          liveness: c.probes.liveness,
          readiness: c.probes.readiness,
          startup: c.probes.startup
        },
        probeIssues: c.probeIssues
      })),
      issues: this.result.issues,
      comparisons: this.result.comparisons,
      environmentGroups: Object.fromEntries(
        Object.entries(this.result.environmentGroups).map(([env, containers]) => [
          env,
          containers.length
        ])
      ),
      parseErrors: this.result.raw.errors || []
    };

    return JSON.stringify(report, null, 2);
  }

  generateMarkdownReport() {
    const lines = [];
    const s = this.result.summary;

    lines.push('# K8s 探针策略分析报告');
    lines.push('');
    lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 📊 分析概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 文件总数 | ${s.totalFiles} |`);
    lines.push(`| 成功解析 | ${s.successfulFiles} |`);
    lines.push(`| 工作负载数 | ${s.totalDocuments} |`);
    lines.push(`| 容器总数 | ${s.totalContainers} |`);
    lines.push('');

    lines.push('## 🔍 探针配置统计');
    lines.push('');
    lines.push('| 探针类型 | 配置数量 | 覆盖率 |');
    lines.push('|----------|----------|--------|');
    lines.push(`| LivenessProbe | ${s.containersWithLiveness} | ${this.percent(s.containersWithLiveness, s.totalContainers)} |`);
    lines.push(`| ReadinessProbe | ${s.containersWithReadiness} | ${this.percent(s.containersWithReadiness, s.totalContainers)} |`);
    lines.push(`| StartupProbe | ${s.containersWithStartup} | ${this.percent(s.containersWithStartup, s.totalContainers)} |`);
    lines.push('');

    if (s.issuesCount > 0 || s.warningsCount > 0) {
      lines.push('## ⚠️ 问题统计');
      lines.push('');
      lines.push(`| 类型 | 数量 |`);
      lines.push(`|------|------|`);
      lines.push(`| ❌ 错误 | ${s.issuesCount} |`);
      lines.push(`| ⚠️ 警告 | ${s.warningsCount} |`);
      lines.push('');
    }

    const envGroups = Object.keys(this.result.environmentGroups);
    if (envGroups.length > 0) {
      lines.push('## 🌍 环境分组');
      lines.push('');
      lines.push('| 环境 | 容器数量 |');
      lines.push('|------|----------|');
      for (const env of envGroups) {
        const count = this.result.environmentGroups[env].length;
        lines.push(`| ${env} | ${count} |`);
      }
      lines.push('');
    }

    if (this.result.comparisons.length > 0) {
      lines.push('## ⚖️ 环境差异分析');
      lines.push('');
      for (const comp of this.result.comparisons) {
        const icon = comp.severity === 'error' ? '❌' : '⚠️';
        lines.push(`${icon} **${comp.message}**`);
        lines.push('');
        lines.push('| 环境 | 平均值 | 最小值 | 最大值 | 样本数 |');
        lines.push('|------|--------|--------|--------|--------|');
        for (const [env, values] of Object.entries(comp.envValues)) {
          lines.push(`| ${env} | ${values.avg.toFixed(1)} | ${values.min} | ${values.max} | ${values.count} |`);
        }
        lines.push('');
      }
    }

    if (this.result.issues.length > 0) {
      lines.push('## 📋 问题详情');
      lines.push('');
      
      const errors = this.result.issues.filter(i => i.severity === 'error');
      const warnings = this.result.issues.filter(i => i.severity === 'warning');

      if (errors.length > 0) {
        lines.push('### ❌ 错误');
        lines.push('');
        for (const issue of errors) {
          lines.push(`- **${issue.message}**`);
          lines.push(`  - 文件: \`${issue.filePath}\``);
          if (issue.workloadName) {
            lines.push(`  - 工作负载: ${issue.workloadKind}/${issue.workloadName}`);
          }
          lines.push(`  - 容器: ${issue.container}`);
          lines.push('');
        }
      }

      if (warnings.length > 0) {
        lines.push('### ⚠️ 警告');
        lines.push('');
        for (const issue of warnings) {
          lines.push(`- **${issue.message}**`);
          lines.push(`  - 文件: \`${issue.filePath}\``);
          if (issue.workloadName) {
            lines.push(`  - 工作负载: ${issue.workloadKind}/${issue.workloadName}`);
          }
          if (issue.container) {
            lines.push(`  - 容器: ${issue.container}`);
          }
          lines.push('');
        }
      }
    }

    if (this.result.raw.errors && this.result.raw.errors.length > 0) {
      lines.push('## ❌ 解析错误（坏行记录）');
      lines.push('');
      for (const error of this.result.raw.errors) {
        lines.push(`- **${error.type}**: ${error.message}`);
        lines.push(`  - 文件: \`${error.filePath}\``);
        if (error.line !== undefined) {
          lines.push(`  - 行号: ${error.line + 1}`);
        }
        if (error.column !== undefined) {
          lines.push(`  - 列号: ${error.column}`);
        }
        lines.push('');
      }
    }

    if (this.result.containers.length > 0) {
      lines.push('## 📦 探针配置详情');
      lines.push('');
      lines.push('| 工作负载/容器 | 探针类型 | initialDelay(s) | period(s) | timeout(s) | failureThreshold |');
      lines.push('|---------------|----------|-----------------|-----------|------------|------------------|');

      for (const container of this.result.containers) {
        const probeTypes = ['liveness', 'readiness', 'startup'];
        let firstRow = true;
        
        for (const probeType of probeTypes) {
          const probe = container.probes[probeType];
          if (probe) {
            lines.push(`| ${firstRow ? container.workloadName + '/' + container.name : ''} | ${probeType} | ${probe.initialDelaySeconds} | ${probe.periodSeconds} | ${probe.timeoutSeconds} | ${probe.failureThreshold} |`);
            firstRow = false;
          }
        }
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*报告由 K8s探针策略CLI 工具自动生成*');

    return lines.join('\n');
  }

  percent(count, total) {
    if (total === 0) return '0%';
    return `${Math.round((count / total) * 100)}%`;
  }

  saveReports(prefix = 'probe-report') {
    const outputs = [];

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const jsonPath = path.join(this.outputDir, `${prefix}.json`);
    fs.writeFileSync(jsonPath, this.generateJsonReport());
    outputs.push({ type: 'json', path: jsonPath });

    const mdPath = path.join(this.outputDir, `${prefix}.md`);
    fs.writeFileSync(mdPath, this.generateMarkdownReport());
    outputs.push({ type: 'markdown', path: mdPath });

    return outputs;
  }

  printTerminalSummary() {
    console.log(this.generateTerminalSummary());
  }
}

module.exports = ReportGenerator;
