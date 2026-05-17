import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { MatrixReport, VersionMatrix, CLIOptions, AnomalySample } from '../types.js';

export function buildReport(matrix: VersionMatrix, rootPath: string, scanTime: string): MatrixReport {
  const errorCount = matrix.conflicts.filter(c => c.severity === 'error').length;
  const warningCount = matrix.conflicts.filter(c => c.severity === 'warning').length;
  const infoCount = matrix.conflicts.filter(c => c.severity === 'info').length;
  
  const recommendations = generateRecommendations(matrix);
  
  const allPackages = Array.from(matrix.compatiblePackages.values()).flat();
  const uniquePackages = Array.from(new Set(allPackages));
  
  return {
    metadata: {
      scanTime,
      rootPath,
      totalPackages: uniquePackages.length,
      totalRequirements: uniquePackages.length
    },
    matrix,
    summary: {
      totalConflicts: matrix.conflicts.length,
      errorCount,
      warningCount,
      infoCount,
      anomalyCount: matrix.anomalies.length
    },
    recommendations
  };
}

function generateRecommendations(matrix: VersionMatrix): string[] {
  const recommendations: string[] = [];
  
  if (matrix.recommendedVersions.length > 0) {
    recommendations.push(`Recommended Node version(s): ${matrix.recommendedVersions.join(', ')}`);
  }
  
  const errors = matrix.conflicts.filter(c => c.severity === 'error');
  if (errors.length > 0) {
    recommendations.push('WARNING: Found version conflicts that may break your build!');
    for (const error of errors.slice(0, 3)) {
      recommendations.push(`  - ${error.message}`);
    }
  }
  
  const warnings = matrix.conflicts.filter(c => c.severity === 'warning');
  if (warnings.length > 0) {
    recommendations.push(`Found ${warnings.length} warning(s) - check CI configuration`);
  }
  
  if (matrix.anomalies.length > 0) {
    recommendations.push(`Found ${matrix.anomalies.length} anomaly/issue(s) - see detailed report`);
  }
  
  return recommendations;
}

export function printTerminalReport(report: MatrixReport): void {
  console.log('\n');
  console.log(chalk.bold.blue('══════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.blue('              Node Version Matrix Report                       '));
  console.log(chalk.bold.blue('══════════════════════════════════════════════════════════════\n'));
  
  console.log(chalk.bold('📅 Scan Time: ') + report.metadata.scanTime);
  console.log(chalk.bold('📍 Project Path: ') + report.metadata.rootPath);
  console.log();
  
  const summaryData = [
    [chalk.bold('Metric'), chalk.bold('Count')],
    ['Total Conflicts', report.summary.totalConflicts],
    [chalk.red('Errors'), chalk.red(report.summary.errorCount)],
    [chalk.yellow('Warnings'), chalk.yellow(report.summary.warningCount)],
    [chalk.blue('Info'), chalk.blue(report.summary.infoCount)],
    ['Anomalies', report.summary.anomalyCount]
  ];
  
  console.log(table(summaryData, {
    header: {
      alignment: 'center',
      content: 'Summary'
    }
  }));
  console.log();
  
  if (report.matrix.recommendedVersions.length > 0) {
    console.log(chalk.bold.green('✅ Recommended Versions:'));
    for (const version of report.matrix.recommendedVersions) {
      console.log(chalk.green(`   • Node.js ${version}`));
    }
    console.log();
  }
  
  if (report.matrix.conflicts.length > 0) {
    console.log(chalk.bold.red('⚠️ Conflicts Found:\n'));
    
    for (const conflict of report.matrix.conflicts) {
      const color = conflict.severity === 'error' ? chalk.red : 
                    conflict.severity === 'warning' ? chalk.yellow : chalk.blue;
      console.log(color(`   [${conflict.severity.toUpperCase()}] ${conflict.message}`));
    }
    console.log();
  }
  
  if (report.matrix.anomalies.length > 0) {
    console.log(chalk.bold.magenta('🔍 Anomalies / Issues:\n'));
    
    for (const anomaly of report.matrix.anomalies) {
      console.log(chalk.magenta(`   [${anomaly.type.toUpperCase()}] ${anomaly.message}`));
      console.log(chalk.magenta(`      Location: ${anomaly.location.file}`));
      if (anomaly.location.raw) {
        console.log(chalk.magenta(`      Raw value: "${anomaly.location.raw}"`));
      }
    }
    console.log();
  }
  
  if (report.recommendations.length > 0) {
    console.log(chalk.bold.cyan('💡 Recommendations:\n'));
    for (const rec of report.recommendations) {
      console.log(chalk.cyan(`   • ${rec}`));
    }
    console.log();
  }
  
  console.log(chalk.bold.blue('══════════════════════════════════════════════════════════════\n'));
}

export async function writeJsonReport(report: MatrixReport, outputPath: string): Promise<void> {
  const reportData = {
    ...report,
    matrix: {
      ...report.matrix,
      compatiblePackages: Object.fromEntries(report.matrix.compatiblePackages)
    }
  };
  
  await fs.writeFile(outputPath, JSON.stringify(reportData, null, 2), 'utf-8');
  console.log(chalk.green(`✅ JSON report written to: ${outputPath}`));
}

export async function writeMarkdownReport(report: MatrixReport, outputPath: string): Promise<void> {
  let markdown = '# Node Version Matrix Report\n\n';
  
  markdown += `## Metadata\n\n`;
  markdown += `- **Scan Time**: ${report.metadata.scanTime}\n`;
  markdown += `- **Project Path**: ${report.metadata.rootPath}\n`;
  markdown += `- **Total Packages**: ${report.metadata.totalPackages}\n`;
  markdown += `- **Total Requirements**: ${report.metadata.totalRequirements}\n\n`;
  
  markdown += `## Summary\n\n`;
  markdown += `| Metric | Count |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Conflicts | ${report.summary.totalConflicts} |\n`;
  markdown += `| Errors | ${report.summary.errorCount} |\n`;
  markdown += `| Warnings | ${report.summary.warningCount} |\n`;
  markdown += `| Info | ${report.summary.infoCount} |\n`;
  markdown += `| Anomalies | ${report.summary.anomalyCount} |\n\n`;
  
  if (report.matrix.recommendedVersions.length > 0) {
    markdown += `## Recommended Versions\n\n`;
    for (const version of report.matrix.recommendedVersions) {
      markdown += `- Node.js ${version}\n`;
    }
    markdown += `\n`;
  }
  
  if (report.matrix.conflicts.length > 0) {
    markdown += `## Conflicts\n\n`;
    for (const conflict of report.matrix.conflicts) {
      markdown += `### [${conflict.severity.toUpperCase()}] ${conflict.type}\n\n`;
      markdown += `${conflict.message}\n\n`;
      markdown += `**Affected Packages**: ${conflict.packages.join(', ')}\n\n`;
    }
  }
  
  if (report.matrix.anomalies.length > 0) {
    markdown += `## Anomalies / Issues\n\n`;
    for (const anomaly of report.matrix.anomalies) {
      markdown += `### [${anomaly.type.toUpperCase()}]\n\n`;
      markdown += `**Message**: ${anomaly.message}\n\n`;
      markdown += `**Cause**: ${anomaly.cause}\n\n`;
      markdown += `**Location**: \`${anomaly.location.file}\`\n`;
      if (anomaly.location.line !== undefined) {
        markdown += `**Line**: ${anomaly.location.line}\n`;
      }
      if (anomaly.location.raw) {
        markdown += `**Raw Value**: \`${anomaly.location.raw}\`\n`;
      }
      markdown += `\n`;
    }
  }
  
  if (report.recommendations.length > 0) {
    markdown += `## Recommendations\n\n`;
    for (const rec of report.recommendations) {
      markdown += `- ${rec}\n`;
    }
    markdown += `\n`;
  }
  
  markdown += `## Compatibility Matrix\n\n`;
  markdown += `| Node Version | Compatible Packages |\n`;
  markdown += `|--------------|---------------------|\n`;
  for (const [version, packages] of report.matrix.compatiblePackages.entries()) {
    markdown += `| ${version} | ${packages.join(', ')} |\n`;
  }
  markdown += `\n`;
  
  await fs.writeFile(outputPath, markdown, 'utf-8');
  console.log(chalk.green(`✅ Markdown report written to: ${outputPath}`));
}

export async function generateReports(report: MatrixReport, options: CLIOptions): Promise<void> {
  const outputDir = options.output || process.cwd();
  
  try {
    await fs.access(outputDir);
  } catch {
    await fs.mkdir(outputDir, { recursive: true });
  }
  
  if (options.format === 'json' || options.format === 'all') {
    await writeJsonReport(report, path.join(outputDir, 'node-matrix-report.json'));
  }
  
  if (options.format === 'markdown' || options.format === 'all') {
    await writeMarkdownReport(report, path.join(outputDir, 'node-matrix-report.md'));
  }
  
  if (options.format === 'terminal' || options.format === 'all') {
    printTerminalReport(report);
  }
}
