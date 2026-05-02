import fs from 'fs';
import path from 'path';

export function generateJsonReport(scanResult, issues, config, options = {}) {
  const report = {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      projectDir: scanResult.projectDir,
    },
    summary: {
      totalFiles: scanResult.files.length,
      totalVariables: Object.keys(scanResult.variables.all).length,
      totalIssues: issues.length,
      issuesBySeverity: {
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length,
      },
    },
    variables: {
      all: Object.keys(scanResult.variables.all).map(name => ({
        name: name,
        sources: scanResult.variables.all[name].sources,
        foundIn: scanResult.variables.all[name].foundIn,
        values: scanResult.variables.all[name].values,
      })),
      bySource: {
        example: Object.keys(scanResult.variables.fromExample),
        local: Object.keys(scanResult.variables.fromLocal),
        docker: Object.keys(scanResult.variables.fromDocker),
        packageJson: Object.keys(scanResult.variables.fromPackageJson),
        markdown: Object.keys(scanResult.variables.fromMarkdown),
      },
    },
    issues: issues.map(issue => ({
      type: issue.type,
      variable: issue.variable,
      severity: issue.severity,
      message: issue.message,
      details: issue.details,
    })),
    hasErrors: issues.some(i => i.severity === 'high' || i.severity === 'medium'),
  };

  if (options.outputFile) {
    const outputPath = path.resolve(options.outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`JSON 报告已写入: ${outputPath}`);
  }

  return report;
}
