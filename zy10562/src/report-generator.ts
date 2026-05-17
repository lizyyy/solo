import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ScanResult, ReportOptions } from './types';

export class ReportGenerator {
  private ensureOutputDir(outputDir: string): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  printConsoleSummary(result: ScanResult): void {
    console.log('\n');
    console.log(chalk.bold.blue('='.repeat(70)));
    console.log(chalk.bold.blue('           Nginx 证书引用扫描报告'));
    console.log(chalk.bold.blue('='.repeat(70)));
    console.log(`\n扫描时间: ${chalk.yellow(result.scanTime.toLocaleString())}`);
    console.log(`配置目录: ${chalk.yellow(result.inputDir)}`);
    console.log(`输出目录: ${chalk.yellow(result.outputDir)}\n`);

    console.log(chalk.bold('📊 扫描统计'));
    console.log(chalk.gray('-'.repeat(50)));
    console.log(`Server 块数量: ${chalk.cyan(result.summary.totalServers)}`);
    console.log(`域名数量: ${chalk.cyan(result.summary.totalDomains)}`);
    console.log(`证书数量: ${chalk.cyan(result.summary.totalCerts)}`);
    console.log(`解析错误: ${result.summary.parseErrors > 0 ? chalk.red(result.summary.parseErrors) : chalk.green(result.summary.parseErrors)}`);
    console.log();

    console.log(chalk.bold('⚠️  证书状态'));
    console.log(chalk.gray('-'.repeat(50)));
    console.log(`已过期: ${result.summary.expired > 0 ? chalk.red(result.summary.expired) : chalk.green(result.summary.expired)}`);
    console.log(`7 天内过期: ${result.summary.expiringIn7Days > 0 ? chalk.yellow(result.summary.expiringIn7Days) : chalk.green(result.summary.expiringIn7Days)}`);
    console.log(`30 天内过期: ${result.summary.expiringIn30Days > 0 ? chalk.yellow(result.summary.expiringIn30Days) : chalk.green(result.summary.expiringIn30Days)}`);
    console.log(`缺失证书引用: ${result.summary.missingCerts > 0 ? chalk.red(result.summary.missingCerts) : chalk.green(result.summary.missingCerts)}`);
    console.log();

    if (result.missingReferences.length > 0) {
      console.log(chalk.bold.red('❌ 缺失证书引用的域名'));
      console.log(chalk.gray('-'.repeat(50)));
      for (const missing of result.missingReferences) {
        const typeText = missing.type === 'both' ? '证书和密钥' : missing.type === 'cert' ? '证书' : '密钥';
        console.log(`${chalk.red(missing.domain)} - 缺少${typeText}`);
        console.log(`  ${chalk.gray(`${missing.serverBlock.file}:${missing.serverBlock.line}`)}`);
      }
      console.log();
    }

    if (result.parseErrors.length > 0) {
      console.log(chalk.bold.yellow('⚠️  解析错误'));
      console.log(chalk.gray('-'.repeat(50)));
      for (const error of result.parseErrors) {
        console.log(`${chalk.yellow(error.file)}:${chalk.yellow(error.line)}`);
        console.log(`  原因: ${error.reason}`);
        if (error.content) {
          console.log(`  内容: ${chalk.gray(error.content.slice(0, 100))}`);
        }
      }
      console.log();
    }

    console.log(chalk.bold('📋 域名证书详情'));
    console.log(chalk.gray('-'.repeat(50)));

    const sortedDomains = [...result.domainCertMaps].sort((a, b) => {
      const daysA = a.certInfo?.daysUntilExpiry ?? 9999;
      const daysB = b.certInfo?.daysUntilExpiry ?? 9999;
      return daysA - daysB;
    });

    for (const domainCert of sortedDomains) {
      const statusColor = this.getStatusColor(domainCert.certInfo?.daysUntilExpiry);
      const statusText = this.getStatusText(domainCert.certInfo?.daysUntilExpiry);

      console.log(`${statusColor(domainCert.domain)} - ${statusText}`);

      if (domainCert.certPath) {
        console.log(`  证书: ${chalk.gray(domainCert.certPath)}`);
      }
      if (domainCert.keyPath) {
        console.log(`  密钥: ${chalk.gray(domainCert.keyPath)}`);
      }
      if (domainCert.certInfo?.validTo) {
        console.log(`  过期时间: ${chalk.gray(domainCert.certInfo.validTo.toLocaleString())}`);
      }

      console.log(`  引用位置: ${domainCert.serverBlocks.length} 处`);
      for (const block of domainCert.serverBlocks.slice(0, 3)) {
        console.log(`    - ${block.file}:${block.line}`);
      }
      if (domainCert.serverBlocks.length > 3) {
        console.log(`    ... 还有 ${domainCert.serverBlocks.length - 3} 处`);
      }
      console.log();
    }

    console.log(chalk.bold.green('✅ 扫描完成!'));
    console.log(chalk.gray(`详细报告已保存至: ${result.outputDir}`));
    console.log();
  }

  private getStatusColor(days?: number): (text: string) => string {
    if (days === undefined) return chalk.gray;
    if (days <= 0) return chalk.red;
    if (days <= 7) return chalk.yellow;
    if (days <= 30) return chalk.yellow;
    return chalk.green;
  }

  private getStatusText(days?: number): string {
    if (days === undefined) return '未知';
    if (days <= 0) return `已过期 (${days} 天)`;
    if (days <= 7) return `${days} 天后过期`;
    if (days <= 30) return `${days} 天后过期`;
    return `${days} 天后过期`;
  }

  generateJsonReport(result: ScanResult, options: ReportOptions): string {
    this.ensureOutputDir(options.outputDir);

    const jsonData = {
      scanTime: result.scanTime.toISOString(),
      inputDir: result.inputDir,
      outputDir: result.outputDir,
      summary: result.summary,
      serverBlocks: result.serverBlocks.map(sb => ({
        file: sb.file,
        line: sb.line,
        serverNames: sb.serverNames,
        sslCertificate: sb.sslCertificate,
        sslCertificateKey: sb.sslCertificateKey,
        listen: sb.listen
      })),
      domainCertMaps: result.domainCertMaps.map(dcm => ({
        domain: dcm.domain,
        certPath: dcm.certPath,
        keyPath: dcm.keyPath,
        certInfo: dcm.certInfo ? {
          path: dcm.certInfo.path,
          exists: dcm.certInfo.exists,
          isValid: dcm.certInfo.isValid,
          subject: dcm.certInfo.subject,
          issuer: dcm.certInfo.issuer,
          validFrom: dcm.certInfo.validFrom?.toISOString(),
          validTo: dcm.certInfo.validTo?.toISOString(),
          daysUntilExpiry: dcm.certInfo.daysUntilExpiry,
          domains: dcm.certInfo.domains,
          error: dcm.certInfo.error
        } : null,
        serverBlocks: dcm.serverBlocks
      })),
      missingReferences: result.missingReferences,
      parseErrors: result.parseErrors
    };

    const filePath = path.join(options.outputDir, `cert-report-${options.timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');

    return filePath;
  }

  generateMarkdownReport(result: ScanResult, options: ReportOptions): string {
    this.ensureOutputDir(options.outputDir);

    const lines: string[] = [];

    lines.push('# Nginx 证书引用扫描报告');
    lines.push('');
    lines.push(`> 扫描时间: ${result.scanTime.toLocaleString()}`);
    lines.push(`> 配置目录: ${result.inputDir}`);
    lines.push('');

    lines.push('## 扫描统计');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| Server 块数量 | ${result.summary.totalServers} |`);
    lines.push(`| 域名数量 | ${result.summary.totalDomains} |`);
    lines.push(`| 证书数量 | ${result.summary.totalCerts} |`);
    lines.push(`| 已过期 | ${result.summary.expired} |`);
    lines.push(`| 7 天内过期 | ${result.summary.expiringIn7Days} |`);
    lines.push(`| 30 天内过期 | ${result.summary.expiringIn30Days} |`);
    lines.push(`| 缺失证书引用 | ${result.summary.missingCerts} |`);
    lines.push(`| 解析错误 | ${result.summary.parseErrors} |`);
    lines.push('');

    if (result.missingReferences.length > 0) {
      lines.push('## ❌ 缺失证书引用');
      lines.push('');
      lines.push('| 域名 | 缺失内容 | 文件位置 |');
      lines.push('|------|----------|----------|');
      for (const missing of result.missingReferences) {
        const typeText = missing.type === 'both' ? '证书和密钥' : missing.type === 'cert' ? '证书' : '密钥';
        lines.push(`| ${missing.domain} | ${typeText} | ${missing.serverBlock.file}:${missing.serverBlock.line} |`);
      }
      lines.push('');
    }

    if (result.parseErrors.length > 0) {
      lines.push('## ⚠️  解析错误');
      lines.push('');
      lines.push('| 文件 | 行号 | 原因 | 内容 |');
      lines.push('|------|------|------|------|');
      for (const error of result.parseErrors) {
        lines.push(`| ${error.file} | ${error.line} | ${error.reason} | ${error.content.slice(0, 50).replace(/\|/g, '')} |`);
      }
      lines.push('');
    }

    lines.push('## 域名证书详情');
    lines.push('');

    const sortedDomains = [...result.domainCertMaps].sort((a, b) => {
      const daysA = a.certInfo?.daysUntilExpiry ?? 9999;
      const daysB = b.certInfo?.daysUntilExpiry ?? 9999;
      return daysA - daysB;
    });

    for (const domainCert of sortedDomains) {
      const statusEmoji = this.getStatusEmoji(domainCert.certInfo?.daysUntilExpiry);
      lines.push(`### ${statusEmoji} ${domainCert.domain}`);
      lines.push('');

      if (domainCert.certPath) {
        lines.push(`- **证书路径**: \`${domainCert.certPath}\``);
      } else {
        lines.push(`- **证书路径**: ❌ 未配置`);
      }

      if (domainCert.keyPath) {
        lines.push(`- **密钥路径**: \`${domainCert.keyPath}\``);
      } else {
        lines.push(`- **密钥路径**: ❌ 未配置`);
      }

      if (domainCert.certInfo?.validTo) {
        lines.push(`- **过期时间**: ${domainCert.certInfo.validTo.toLocaleString()}`);
      }

      if (domainCert.certInfo?.daysUntilExpiry !== undefined) {
        const days = domainCert.certInfo.daysUntilExpiry;
        if (days <= 0) {
          lines.push(`- **剩余天数**: ❌ 已过期 (${days} 天)`);
        } else if (days <= 7) {
          lines.push(`- **剩余天数**: ⚠️ ${days} 天`);
        } else if (days <= 30) {
          lines.push(`- **剩余天数**: ⚠️ ${days} 天`);
        } else {
          lines.push(`- **剩余天数**: ✅ ${days} 天`);
        }
      }

      lines.push(`- **引用位置**: ${domainCert.serverBlocks.length} 处`);
      for (const block of domainCert.serverBlocks) {
        lines.push(`  - \`${block.file}:${block.line}\``);
      }

      lines.push('');
    }

    lines.push('## 注意事项');
    lines.push('');
    lines.push('- 本报告为自动生成，请勿直接修改');
    lines.push('- 发现证书即将过期时，请提前进行续期操作');
    lines.push('- 如发现缺失证书引用，请检查 Nginx 配置');
    lines.push('');

    const filePath = path.join(options.outputDir, `cert-report-${options.timestamp}.md`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

    return filePath;
  }

  private getStatusEmoji(days?: number): string {
    if (days === undefined) return '❓';
    if (days <= 0) return '❌';
    if (days <= 30) return '⚠️';
    return '✅';
  }
}
