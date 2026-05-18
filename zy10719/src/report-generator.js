const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { table } = require('table');

class ReportGenerator {
  constructor(results, outputDir) {
    this.results = results;
    this.outputDir = outputDir;
    this.generatedFiles = [];
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  generateAllReports() {
    this.generateSummaryReport();
    this.generateDomainCheckReport();
    this.generateNodeDifferenceReport();
    this.generateIssuesReport();
    this.generateConsoleSummary();
    
    return this.generatedFiles;
  }

  generateSummaryReport() {
    const filePath = path.join(this.outputDir, 'summary.json');
    const summary = {
      reportName: '证书部署清单域名证书到期检查 - 汇总报告',
      generatedAt: new Date().toISOString(),
      summary: this.results.summary,
      generatedFiles: this.generatedFiles.map(f => f.fileName)
    };
    
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf8');
    this.generatedFiles.push({
      fileName: 'summary.json',
      description: '检查汇总报告，包含统计数据和生成文件列表'
    });
  }

  generateDomainCheckReport() {
    const filePath = path.join(this.outputDir, 'domain-checks.json');
    const report = {
      reportName: '证书部署清单域名证书到期检查 - 域名检查详情',
      generatedAt: new Date().toISOString(),
      domainCount: this.results.domainChecks.length,
      domains: this.results.domainChecks.map(check => ({
        domain: check.domain,
        hasCert: check.hasCert,
        isWildcardMatch: check.isWildcardMatch,
        wildcardSource: check.wildcardSource,
        isExpired: check.isExpired,
        isExpiringSoon: check.isExpiringSoon,
        daysRemaining: check.daysRemaining,
        chainComplete: check.chainComplete,
        chainLength: check.chainLength,
        affectedNodes: check.nodes.length,
        nodes: check.nodes,
        certs: check.certs.map(c => ({
          sourceFile: c.sourceFile,
          commonName: c.commonName,
          validTo: c.validTo,
          daysRemaining: c.daysRemaining,
          fingerprintSha256: c.fingerprintSha256
        }))
      }))
    };
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
    this.generatedFiles.push({
      fileName: 'domain-checks.json',
      description: '每个域名的证书检查详情，包括到期时间、通配符匹配、证书链状态等'
    });
  }

  generateNodeDifferenceReport() {
    const filePath = path.join(this.outputDir, 'node-differences.json');
    const report = {
      reportName: '证书部署清单域名证书到期检查 - 节点证书差异表',
      generatedAt: new Date().toISOString(),
      differenceCount: this.results.nodeDifferences.length,
      differences: this.results.nodeDifferences.map(diff => ({
        domain: diff.domain,
        nodeId: diff.nodeId,
        nodeName: diff.nodeName,
        environment: diff.environment,
        isLegacy: diff.isLegacy,
        differences: diff.differences.map(d => ({
          type: d.type,
          field: d.field,
          expected: d.expected,
          actual: d.actual,
          severity: d.severity
        })),
        expectedCert: diff.expectedCert,
        actualCert: diff.actualCert,
        deployHistory: diff.deployHistory
      }))
    };
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
    this.generatedFiles.push({
      fileName: 'node-differences.json',
      description: '节点证书差异表，列出所有节点与期望证书不一致的详细情况'
    });
  }

  generateIssuesReport() {
    const filePath = path.join(this.outputDir, 'issues.json');
    const report = {
      reportName: '证书部署清单域名证书到期检查 - 问题清单',
      generatedAt: new Date().toISOString(),
      issueCount: this.results.issues.length,
      issues: this.results.issues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        domain: issue.domain,
        nodeId: issue.nodeId,
        nodeName: issue.nodeName,
        isLegacy: issue.isLegacy,
        affectedNodes: issue.affectedNodes,
        daysRemaining: issue.daysRemaining,
        field: issue.field,
        expected: issue.expected,
        actual: issue.actual
      }))
    };
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
    this.generatedFiles.push({
      fileName: 'issues.json',
      description: '所有问题清单，按严重程度排序，包括过期、即将过期、不一致、缺失等'
    });
  }

  generateConsoleSummary() {
    console.log('\n');
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.blue('            证书部署清单域名证书到期检查 CLI'));
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    console.log('\n');

    console.log(chalk.bold('📊 检查汇总'));
    console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
    const summaryData = [
      ['检查项', '数量'],
      ['证书文件', this.results.summary.certFiles],
      ['有效证书', this.results.summary.validCerts],
      ['总节点数', this.results.summary.totalNodes],
      ['活跃节点', this.results.summary.activeNodes],
      ['旧节点', this.results.summary.legacyNodes],
      ['部署日志', this.results.summary.deployLogs],
      ['成功部署', this.results.summary.successfulDeploys]
    ];
    console.log(table(summaryData));

    console.log(chalk.bold('⚠️  问题统计'));
    console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
    const issues = this.results.summary.issues || {};
    const issueData = [
      ['严重程度', '数量'],
      [chalk.red('CRITICAL (严重)'), issues.critical || 0],
      [chalk.magenta('ERROR (错误)'), issues.error || 0],
      [chalk.yellow('WARNING (警告)'), issues.warning || 0],
      [chalk.blue('INFO (信息)'), issues.info || 0],
      [chalk.bold('总计'), issues.total || 0]
    ];
    console.log(table(issueData));

    if (this.results.issues.length > 0) {
      console.log(chalk.bold('📋 问题详情 (前10条)'));
      console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
      
      const topIssues = this.results.issues.slice(0, 10);
      topIssues.forEach((issue, index) => {
        const severityColor = {
          critical: chalk.red.bold,
          error: chalk.magenta,
          warning: chalk.yellow,
          info: chalk.blue
        };
        const colorFn = severityColor[issue.severity] || chalk.gray;
        
        console.log(`  ${index + 1}. [${colorFn(issue.severity.toUpperCase())}] ${issue.message}`);
        
        if (issue.field) {
          console.log(`     ${chalk.gray('字段:')} ${issue.field}`);
          console.log(`     ${chalk.green('期望:')} ${issue.expected}`);
          console.log(`     ${chalk.red('实际:')} ${issue.actual}`);
        }
        console.log('');
      });
    }

    if (this.results.nodeDifferences.length > 0) {
      console.log(chalk.bold('🔍 节点证书差异表'));
      console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
      
      const diffTableData = [
        ['域名', '节点', '环境', '差异类型', '严重程度']
      ];
      
      this.results.nodeDifferences.slice(0, 5).forEach(diff => {
        diff.differences.forEach(d => {
          const severityColor = d.severity === 'error' ? chalk.red : chalk.yellow;
          diffTableData.push([
            diff.domain,
            diff.nodeName,
            diff.environment,
            d.field,
            severityColor(d.severity)
          ]);
        });
      });
      
      if (diffTableData.length > 1) {
        console.log(table(diffTableData));
      }
    }

    console.log(chalk.bold('📁 生成文件'));
    console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
    this.generatedFiles.forEach(file => {
      console.log(`  • ${chalk.cyan(file.fileName)}: ${file.description}`);
    });

    console.log('\n');
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.green(`  检查完成！输出目录: ${this.outputDir}`));
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    console.log('\n');
  }
}

module.exports = ReportGenerator;
