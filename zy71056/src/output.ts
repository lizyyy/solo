import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { LicenseReport, PackageInfo, Violation } from './types';

export function printTerminalSummary(report: LicenseReport): void {
  const { summary, violations, exceptions } = report;

  console.log('\n');
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
  console.log(chalk.bold.cyan('           NPM 工作区许可证清单报告'));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
  console.log('');

  console.log(chalk.bold('📦 包统计'));
  console.log(`  总计: ${chalk.white(summary.totalPackages)} 个包`);
  console.log(`  工作区包: ${chalk.blue(summary.workspacePackages)} 个`);
  console.log(`  外部依赖: ${chalk.green(summary.externalPackages)} 个`);
  console.log(`  私有包: ${chalk.gray(summary.privatePackages)} 个`);
  console.log('');

  console.log(chalk.bold('📜 许可证统计'));
  console.log(`  有许可证: ${chalk.green(summary.packagesWithLicense)} 个`);
  console.log(`  缺失许可证: ${summary.packagesMissingLicense > 0 ? chalk.yellow(summary.packagesMissingLicense) : chalk.green(summary.packagesMissingLicense)} 个`);
  console.log(`  双许可证: ${chalk.magenta(summary.dualLicensePackages)} 个`);
  console.log('');

  console.log(chalk.bold('⚠️  合规检查'));
  console.log(`  违规项: ${violations.length > 0 ? chalk.red(violations.length) : chalk.green(violations.length)} 个`);
  console.log(`  例外项: ${chalk.cyan(exceptions.length)} 个`);
  console.log('');

  if (violations.length > 0) {
    console.log(chalk.bold.red('❌ 违规详情:'));
    for (const v of violations) {
      const severity = v.severity === 'error' ? chalk.red('ERROR') : chalk.yellow('WARN');
      console.log(`  [${severity}] ${v.packageName}@${v.packageVersion}: ${v.message}`);
    }
    console.log('');
  }

  if (exceptions.length > 0) {
    console.log(chalk.bold.cyan('✅ 例外项:'));
    for (const ex of exceptions) {
      const version = ex.version ? `@${ex.version}` : '';
      console.log(`  - ${ex.name}${version}: ${ex.reason}`);
    }
    console.log('');
  }

  console.log(chalk.bold('🚪 退出码'));
  console.log(`  代码: ${report.exitCode}`);
  console.log(`  说明: ${report.exitCodeDescription}`);
  console.log('');

  console.log(`生成时间: ${report.generatedAt}`);
  console.log('═══════════════════════════════════════════════════\n');
}

export function writeJsonReport(report: LicenseReport, outputDir: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, 'license-report.json');
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return filePath;
}

export function writeMarkdownReport(report: LicenseReport, outputDir: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, 'license-report.md');
  const content = generateMarkdownContent(report);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function generateMarkdownContent(report: LicenseReport): string {
  const { summary, packages, violations, exceptions } = report;

  const workspacePackages = packages.filter(p => p.isWorkspace);
  const externalPackages = packages.filter(p => !p.isWorkspace);

  let md = '# NPM 工作区许可证清单报告\n\n';
  md += `> 生成时间: ${report.generatedAt}\n`;
  md += `> CLI 版本: ${report.cliVersion}\n\n`;

  md += '## 📊 概览\n\n';
  md += '| 指标 | 数值 |\n';
  md += '|------|------|\n';
  md += `| 总包数 | ${summary.totalPackages} |\n`;
  md += `| 工作区包 | ${summary.workspacePackages} |\n`;
  md += `| 外部依赖 | ${summary.externalPackages} |\n`;
  md += `| 私有包 | ${summary.privatePackages} |\n`;
  md += `| 有许可证 | ${summary.packagesWithLicense} |\n`;
  md += `| 缺失许可证 | ${summary.packagesMissingLicense} |\n`;
  md += `| 双许可证 | ${summary.dualLicensePackages} |\n`;
  md += `| 违规项 | ${violations.length} |\n`;
  md += `| 例外项 | ${exceptions.length} |\n\n`;

  md += `## 🚪 执行结果\n\n`;
  md += `- **退出码**: \`${report.exitCode}\`\n`;
  md += `- **说明**: ${report.exitCodeDescription}\n\n`;

  if (violations.length > 0) {
    md += '## ⚠️  违规项\n\n';
    md += '| 包名 | 版本 | 类型 | 许可证 | 严重程度 | 说明 |\n';
    md += '|------|------|------|--------|----------|------|\n';
    for (const v of violations) {
      md += `| ${v.packageName} | ${v.packageVersion} | ${v.type} | ${v.license || '-'} | ${v.severity} | ${v.message} |\n`;
    }
    md += '\n';
  }

  if (exceptions.length > 0) {
    md += '## ✅ 例外清单\n\n';
    md += '| 包名 | 版本 | 原因 | 批准人 | 批准时间 |\n';
    md += '|------|------|------|--------|----------|\n';
    for (const ex of exceptions) {
      md += `| ${ex.name} | ${ex.version || '-'} | ${ex.reason} | ${ex.approvedBy || '-'} | ${ex.approvedAt || '-'} |\n`;
    }
    md += '\n';
  }

  if (workspacePackages.length > 0) {
    md += '## 📦 工作区包\n\n';
    md += '| 包名 | 版本 | 许可证 | 私有 | 路径 |\n';
    md += '|------|------|--------|------|------|\n';
    for (const pkg of workspacePackages) {
      md += `| ${pkg.name} | ${pkg.version} | ${formatLicenseCell(pkg.license)} | ${pkg.isPrivate ? '✅' : ''} | \`${pkg.path}\` |\n`;
    }
    md += '\n';
  }

  md += '## 📚 外部依赖许可证清单\n\n';

  const licenseGroups = groupPackagesByLicense(externalPackages);
  for (const [license, pkgs] of Object.entries(licenseGroups).sort()) {
    md += `### ${license} (${pkgs.length})\n\n`;
    for (const pkg of pkgs) {
      md += `- \`${pkg.name}@${pkg.version}\`\n`;
    }
    md += '\n';
  }

  const missingLicensePkgs = packages.filter(p => !p.license);
  if (missingLicensePkgs.length > 0) {
    md += '### ❓ 缺失许可证文件\n\n';
    for (const pkg of missingLicensePkgs) {
      md += `- \`${pkg.name}@${pkg.version}\`\n`;
    }
    md += '\n';
  }

  return md;
}

function formatLicenseCell(license: string | null): string {
  if (!license) return '❓';
  return `\`${license}\``;
}

function groupPackagesByLicense(packages: PackageInfo[]): Record<string, PackageInfo[]> {
  const groups: Record<string, PackageInfo[]> = {};

  for (const pkg of packages) {
    const license = pkg.license || 'UNKNOWN';
    if (!groups[license]) {
      groups[license] = [];
    }
    groups[license].push(pkg);
  }

  return groups;
}
