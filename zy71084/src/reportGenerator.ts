import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import {
  CheckReport,
  CheckStatus,
  CheckResultItem,
  OutputFormats
} from './types';

export class ReportGenerator {
  static generateReport(
    report: CheckReport,
    outputDir: string,
    formats: OutputFormats
  ): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (formats.terminal) {
      this.printTerminalSummary(report);
    }

    if (formats.json) {
      const jsonPath = path.join(outputDir, 'cert-check-report.json');
      this.writeJsonReport(report, jsonPath);
      console.log(chalk.gray(`\n📄 JSON 报告已保存: ${jsonPath}`));
    }

    if (formats.markdown) {
      const mdPath = path.join(outputDir, 'cert-check-report.md');
      this.writeMarkdownReport(report, mdPath);
      console.log(chalk.gray(`📄 Markdown 报告已保存: ${mdPath}`));
    }
  }

  static printTerminalSummary(report: CheckReport): void {
    console.log('\n' + chalk.bold.cyan('═══════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('           Xcode 证书体检报告'));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
    console.log(chalk.gray(`生成时间: ${report.generatedAt.toLocaleString()}\n`));

    this.printSummaryStats(report);
    this.printProfileResults(report);
    this.printCertificateResults(report);
    this.printTargetResults(report);
    this.printAllIssues(report);
    this.printFinalResult(report);
  }

  private static printSummaryStats(report: CheckReport): void {
    const { summary } = report;
    
    console.log(chalk.bold('📊 检查统计'));
    console.log('─────────────────────────────────────────────────────');
    
    const stats = [
      { label: '总检查项', value: summary.total, color: chalk.white },
      { label: '✅ 通过', value: summary.passed, color: chalk.green },
      { label: '⚠️  警告', value: summary.warnings, color: chalk.yellow },
      { label: '❌ 错误', value: summary.errors, color: chalk.red },
      { label: '⏭️  跳过', value: summary.skipped, color: chalk.gray }
    ];

    stats.forEach(stat => {
      console.log(`  ${stat.color(stat.label.padEnd(12))}: ${stat.color.bold(stat.value.toString())}`);
    });
    
    console.log('');
  }

  private static printProfileResults(report: CheckReport): void {
    if (report.profiles.length === 0) return;

    console.log(chalk.bold('📱 Profile 检查结果'));
    console.log('─────────────────────────────────────────────────────');

    report.profiles.forEach(result => {
      const statusIcon = this.getStatusIcon(result.overallStatus);
      const statusColor = this.getStatusColor(result.overallStatus);
      
      console.log(`\n  ${statusIcon} ${chalk.bold(result.profile.name)}`);
      console.log(`     ${chalk.gray(`UUID: ${result.profile.uuid}`)}`);
      console.log(`     ${chalk.gray(`Bundle ID: ${result.profile.bundleId}`)}`);
      console.log(`     ${chalk.gray(`Team ID: ${result.profile.teamId}`)}`);
      console.log(`     ${chalk.gray(`过期时间: ${result.profile.expirationDate.toLocaleDateString()}`)}`);
      
      result.checks.forEach(check => {
        if (check.status !== CheckStatus.PASS) {
          const icon = this.getStatusIcon(check.status);
          const color = this.getStatusColor(check.status);
          console.log(`     ${icon} ${color(check.message)}`);
          if (check.details) {
            console.log(`        ${chalk.gray(check.details)}`);
          }
        }
      });
    });
    
    console.log('');
  }

  private static printCertificateResults(report: CheckReport): void {
    if (report.certificates.length === 0) return;

    console.log(chalk.bold('🔐 证书检查结果'));
    console.log('─────────────────────────────────────────────────────');

    report.certificates.forEach(result => {
      const statusIcon = this.getStatusIcon(result.overallStatus);
      
      console.log(`\n  ${statusIcon} ${chalk.bold(result.certificate.name || result.certificate.commonName)}`);
      console.log(`     ${chalk.gray(`类型: ${result.certificate.type}`)}`);
      console.log(`     ${chalk.gray(`Team ID: ${result.certificate.teamId}`)}`);
      console.log(`     ${chalk.gray(`过期时间: ${result.certificate.notAfter.toLocaleDateString()}`)}`);
      
      result.checks.forEach(check => {
        if (check.status !== CheckStatus.PASS) {
          const icon = this.getStatusIcon(check.status);
          const color = this.getStatusColor(check.status);
          console.log(`     ${icon} ${color(check.message)}`);
          if (check.details) {
            console.log(`        ${chalk.gray(check.details)}`);
          }
        }
      });
    });
    
    console.log('');
  }

  private static printTargetResults(report: CheckReport): void {
    if (report.targets.length === 0) return;

    console.log(chalk.bold('🎯 Target 检查结果'));
    console.log('─────────────────────────────────────────────────────');

    report.targets.forEach(result => {
      const statusIcon = this.getStatusIcon(result.overallStatus);
      const location = result.target.source !== 'cli' 
        ? `${result.target.source}:${result.target.lineNumber}`
        : 'CLI';
      
      console.log(`\n  ${statusIcon} ${chalk.bold(result.target.name)}`);
      console.log(`     ${chalk.gray(`Bundle ID: ${result.target.bundleId}`)}`);
      console.log(`     ${chalk.gray(`来源: ${location}`)}`);
      
      if (result.matchedProfile) {
        console.log(`     ${chalk.green('✓')} 匹配 Profile: ${result.matchedProfile.name}`);
      }
      if (result.matchedCertificate) {
        console.log(`     ${chalk.green('✓')} 匹配证书: ${result.matchedCertificate.name}`);
      }
      
      result.checks.forEach(check => {
        if (check.status !== CheckStatus.PASS) {
          const icon = this.getStatusIcon(check.status);
          const color = this.getStatusColor(check.status);
          const loc = check.location?.line ? ` [行 ${check.location.line}]` : '';
          console.log(`     ${icon} ${color(check.message)}${loc}`);
          if (check.details) {
            console.log(`        ${chalk.gray(check.details)}`);
          }
        }
      });
    });
    
    console.log('');
  }

  private static printAllIssues(report: CheckReport): void {
    const allIssues: CheckResultItem[] = [];
    
    report.profiles.forEach(r => allIssues.push(...r.checks.filter(c => c.status !== CheckStatus.PASS)));
    report.certificates.forEach(r => allIssues.push(...r.checks.filter(c => c.status !== CheckStatus.PASS)));
    report.targets.forEach(r => allIssues.push(...r.checks.filter(c => c.status !== CheckStatus.PASS)));

    if (allIssues.length === 0) return;

    console.log(chalk.bold('🔍 问题清单'));
    console.log('─────────────────────────────────────────────────────');

    const errors = allIssues.filter(c => c.status === CheckStatus.ERROR);
    const warnings = allIssues.filter(c => c.status === CheckStatus.WARN);

    if (errors.length > 0) {
      console.log(`\n  ${chalk.red.bold(`❌ 错误 (${errors.length})`)}`);
      errors.forEach((check, i) => {
        const location = check.location 
          ? `${check.location.file}${check.location.line ? `:${check.location.line}` : ''}`
          : '';
        console.log(`     ${i + 1}. ${chalk.red(check.message)}`);
        if (location) {
          console.log(`        ${chalk.gray(location)}`);
        }
        if (check.details) {
          console.log(`        ${chalk.gray(check.details)}`);
        }
      });
    }

    if (warnings.length > 0) {
      console.log(`\n  ${chalk.yellow.bold(`⚠️  警告 (${warnings.length})`)}`);
      warnings.forEach((check, i) => {
        const location = check.location 
          ? `${check.location.file}${check.location.line ? `:${check.location.line}` : ''}`
          : '';
        console.log(`     ${i + 1}. ${chalk.yellow(check.message)}`);
        if (location) {
          console.log(`        ${chalk.gray(location)}`);
        }
        if (check.details) {
          console.log(`        ${chalk.gray(check.details)}`);
        }
      });
    }
    
    console.log('');
  }

  private static printFinalResult(report: CheckReport): void {
    console.log('─────────────────────────────────────────────────────');
    
    if (report.exitCode === 0) {
      if (report.summary.warnings > 0) {
        console.log(chalk.yellow.bold('\n🎉 检查完成 (有警告)'));
        console.log(chalk.yellow(`   发现 ${report.summary.warnings} 个警告，请检查报告`));
      } else {
        console.log(chalk.green.bold('\n🎉 检查通过！'));
        console.log(chalk.green('   所有检查项均通过，可以放心打包'));
      }
    } else {
      console.log(chalk.red.bold('\n❌ 检查失败！'));
      console.log(chalk.red(`   发现 ${report.summary.errors} 个错误，请修复后重试`));
    }
    
    console.log(chalk.cyan(`\n退出码: ${report.exitCode}`));
    console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));
  }

  private static getStatusIcon(status: CheckStatus): string {
    switch (status) {
      case CheckStatus.PASS: return '✅';
      case CheckStatus.WARN: return '⚠️';
      case CheckStatus.ERROR: return '❌';
      case CheckStatus.SKIP: return '⏭️';
      default: return '❓';
    }
  }

  private static getStatusColor(status: CheckStatus): chalk.Chalk {
    switch (status) {
      case CheckStatus.PASS: return chalk.green;
      case CheckStatus.WARN: return chalk.yellow;
      case CheckStatus.ERROR: return chalk.red;
      case CheckStatus.SKIP: return chalk.gray;
      default: return chalk.white;
    }
  }

  static writeJsonReport(report: CheckReport, filePath: string): void {
    const jsonData = JSON.stringify(report, null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf8');
  }

  static writeMarkdownReport(report: CheckReport, filePath: string): void {
    const content = this.generateMarkdownContent(report);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  private static generateMarkdownContent(report: CheckReport): string {
    const lines: string[] = [];
    
    lines.push('# Xcode 证书体检报告');
    lines.push('');
    lines.push(`> 生成时间: ${report.generatedAt.toLocaleString()}`);
    lines.push(`> 退出码: ${report.exitCode}`);
    lines.push('');

    lines.push('## 📊 检查统计');
    lines.push('');
    lines.push('| 状态 | 数量 |');
    lines.push('|------|------|');
    lines.push(`| ✅ 通过 | ${report.summary.passed} |`);
    lines.push(`| ⚠️ 警告 | ${report.summary.warnings} |`);
    lines.push(`| ❌ 错误 | ${report.summary.errors} |`);
    lines.push(`| ⏭️ 跳过 | ${report.summary.skipped} |`);
    lines.push(`| **总计** | **${report.summary.total}** |`);
    lines.push('');

    if (report.profiles.length > 0) {
      lines.push('## 📱 Profile 检查结果');
      lines.push('');
      
      report.profiles.forEach(result => {
        const statusBadge = this.getMarkdownStatusBadge(result.overallStatus);
        lines.push(`### ${statusBadge} ${result.profile.name}`);
        lines.push('');
        lines.push('- **UUID**: ' + result.profile.uuid);
        lines.push('- **Bundle ID**: ' + result.profile.bundleId);
        lines.push('- **Team ID**: ' + result.profile.teamId);
        lines.push('- **Team Name**: ' + (result.profile.teamName || 'N/A'));
        lines.push('- **过期时间**: ' + result.profile.expirationDate.toLocaleString());
        lines.push('');
        
        const issues = result.checks.filter(c => c.status !== CheckStatus.PASS);
        if (issues.length > 0) {
          lines.push('#### 问题');
          lines.push('');
          issues.forEach(check => {
            const icon = this.getStatusIcon(check.status);
            lines.push(`- ${icon} **${check.checkName}**: ${check.message}`);
            if (check.details) {
              lines.push(`  - ${check.details}`);
            }
          });
          lines.push('');
        }
      });
    }

    if (report.certificates.length > 0) {
      lines.push('## 🔐 证书检查结果');
      lines.push('');
      
      report.certificates.forEach(result => {
        const statusBadge = this.getMarkdownStatusBadge(result.overallStatus);
        const name = result.certificate.name || result.certificate.commonName;
        lines.push(`### ${statusBadge} ${name}`);
        lines.push('');
        lines.push('- **类型**: ' + result.certificate.type);
        lines.push('- **Team ID**: ' + (result.certificate.teamId || 'N/A'));
        lines.push('- **Team Name**: ' + (result.certificate.teamName || 'N/A'));
        lines.push('- **生效时间**: ' + result.certificate.notBefore.toLocaleString());
        lines.push('- **过期时间**: ' + result.certificate.notAfter.toLocaleString());
        lines.push('');
        
        const issues = result.checks.filter(c => c.status !== CheckStatus.PASS);
        if (issues.length > 0) {
          lines.push('#### 问题');
          lines.push('');
          issues.forEach(check => {
            const icon = this.getStatusIcon(check.status);
            lines.push(`- ${icon} **${check.checkName}**: ${check.message}`);
            if (check.details) {
              lines.push(`  - ${check.details}`);
            }
          });
          lines.push('');
        }
      });
    }

    if (report.targets.length > 0) {
      lines.push('## 🎯 Target 检查结果');
      lines.push('');
      
      report.targets.forEach(result => {
        const statusBadge = this.getMarkdownStatusBadge(result.overallStatus);
        lines.push(`### ${statusBadge} ${result.target.name}`);
        lines.push('');
        lines.push('- **Bundle ID**: ' + result.target.bundleId);
        lines.push('- **来源**: ' + result.target.source + (result.target.lineNumber > 0 ? ` (行 ${result.target.lineNumber})` : ''));
        if (result.matchedProfile) {
          lines.push('- **匹配 Profile**: ' + result.matchedProfile.name);
        }
        if (result.matchedCertificate) {
          lines.push('- **匹配证书**: ' + result.matchedCertificate.name);
        }
        lines.push('');
        
        const issues = result.checks.filter(c => c.status !== CheckStatus.PASS);
        if (issues.length > 0) {
          lines.push('#### 问题');
          lines.push('');
          issues.forEach(check => {
            const icon = this.getStatusIcon(check.status);
            const loc = check.location?.line ? ` (行 ${check.location.line})` : '';
            lines.push(`- ${icon} **${check.checkName}**: ${check.message}${loc}`);
            if (check.details) {
              lines.push(`  - ${check.details}`);
            }
          });
          lines.push('');
        }
      });
    }

    lines.push('## 📋 完整问题清单');
    lines.push('');
    
    const allChecks = [
      ...report.profiles.flatMap(r => r.checks),
      ...report.certificates.flatMap(r => r.checks),
      ...report.targets.flatMap(r => r.checks)
    ];
    
    const issues = allChecks.filter(c => c.status !== CheckStatus.PASS);
    
    if (issues.length === 0) {
      lines.push('✅ 没有发现任何问题！');
    } else {
      const errors = issues.filter(c => c.status === CheckStatus.ERROR);
      const warnings = issues.filter(c => c.status === CheckStatus.WARN);
      
      if (errors.length > 0) {
        lines.push(`### ❌ 错误 (${errors.length})`);
        lines.push('');
        errors.forEach((check, i) => {
          const location = check.location 
            ? `${check.location.file}${check.location.line ? `:${check.location.line}` : ''}`
            : '未知位置';
          lines.push(`${i + 1}. **${check.checkName}**: ${check.message}`);
          lines.push(`   - 位置: ${location}`);
          if (check.details) {
            lines.push(`   - ${check.details}`);
          }
          lines.push('');
        });
      }
      
      if (warnings.length > 0) {
        lines.push(`### ⚠️ 警告 (${warnings.length})`);
        lines.push('');
        warnings.forEach((check, i) => {
          const location = check.location 
            ? `${check.location.file}${check.location.line ? `:${check.location.line}` : ''}`
            : '未知位置';
          lines.push(`${i + 1}. **${check.checkName}**: ${check.message}`);
          lines.push(`   - 位置: ${location}`);
          if (check.details) {
            lines.push(`   - ${check.details}`);
          }
          lines.push('');
        });
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('*报告由 Xcode 证书体检 CLI 自动生成*');

    return lines.join('\n');
  }

  private static getMarkdownStatusBadge(status: CheckStatus): string {
    switch (status) {
      case CheckStatus.PASS: return '✅ **通过**';
      case CheckStatus.WARN: return '⚠️ **警告**';
      case CheckStatus.ERROR: return '❌ **错误**';
      case CheckStatus.SKIP: return '⏭️ **跳过**';
      default: return '❓';
    }
  }
}
