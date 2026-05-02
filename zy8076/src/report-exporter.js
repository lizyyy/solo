const fs = require('fs');
const path = require('path');

class ReportExporter {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  formatDiff(diff) {
    if (!diff || diff.length === 0) return 'No changes';

    return diff.map(d => {
      switch (d.type) {
        case 'added':
          return '  + ' + d.path + ': ' + JSON.stringify(d.newValue);
        case 'removed':
          return '  - ' + d.path + ': ' + JSON.stringify(d.oldValue);
        case 'modified':
          return '  ~ ' + d.path + ': ' + JSON.stringify(d.oldValue) + ' -> ' + JSON.stringify(d.newValue);
        default:
          return '    ' + d.path + ': ' + JSON.stringify(d.newValue || d.oldValue);
      }
    }).join('\n');
  }

  generateMarkdown(report) {
    const lines = [];

    lines.push('# Migration Report\n');
    lines.push('**Generated:** ' + report.generatedAt);
    lines.push('**From Version:** ' + report.fromVersion);
    lines.push('**To Version:** ' + report.toVersion);
    lines.push('**Status:** ' + (report.success ? 'SUCCESS' : 'FAILED') + '\n');

    lines.push('## Summary\n');
    lines.push('- **Total Snapshots:** ' + report.totalSnapshots);
    lines.push('- **Successful:** ' + report.successful);
    lines.push('- **Failed:** ' + report.failed);
    lines.push('- **Skipped Versions:** ' + (report.skippedVersions?.length > 0 ? report.skippedVersions.join(', ') : 'None'));
    lines.push('- **Total Migration Steps:** ' + report.totalSteps);
    lines.push('- **Rollbacks Triggered:** ' + report.rollbacksTriggered + '\n');

    lines.push('## Version Chain\n');
    lines.push(report.versionChain.join(' -> ') + '\n');

    lines.push('## Migration Steps\n');
    for (const step of report.steps) {
      lines.push('### Version ' + step.version + '\n');
      lines.push('- **Status:** ' + (step.success ? 'Success' : 'Failed'));
      if (step.duration) {
        lines.push('- **Duration:** ' + step.duration + 'ms');
      }
      lines.push('\n**Before:**');
      lines.push('```json');
      lines.push(JSON.stringify(step.before, null, 2));
      lines.push('```\n');
      lines.push('**After:**');
      lines.push('```json');
      lines.push(JSON.stringify(step.after, null, 2));
      lines.push('```\n');
      lines.push('**Diff:**');
      lines.push('```');
      lines.push(this.formatDiff(step.diff));
      lines.push('```\n');

      if (step.validationErrors && step.validationErrors.length > 0) {
        lines.push('**Validation Errors:**');
        for (const err of step.validationErrors) {
          lines.push('  - [' + err.rule + '] ' + err.message);
        }
        lines.push('');
      }

      if (step.error) {
        lines.push('**Error:** ' + step.error + '\n');
      }

      if (step.rollbackTriggered) {
        lines.push('**WARNING: Rollback was triggered**\n');
      }
    }

    lines.push('## Field Level Diff Summary\n');
    const allDiffs = report.steps.flatMap(s => s.diff || []);
    const fieldChanges = {};
    for (const d of allDiffs) {
      const field = d.path.split('.')[0];
      if (!fieldChanges[field]) {
        fieldChanges[field] = { added: 0, removed: 0, modified: 0 };
      }
      if (d.type === 'added') fieldChanges[field].added++;
      else if (d.type === 'removed') fieldChanges[field].removed++;
      else if (d.type === 'modified') fieldChanges[field].modified++;
    }

    lines.push('| Field | Added | Removed | Modified |');
    lines.push('|-------|-------|---------|----------|');
    for (const [field, counts] of Object.entries(fieldChanges)) {
      lines.push('| ' + field + ' | ' + counts.added + ' | ' + counts.removed + ' | ' + counts.modified + ' |');
    }
    lines.push('');

    if (report.rollbackSeeds && report.rollbackSeeds.length > 0) {
      lines.push('## Rollback Seeds\n');
      lines.push('The following rollback seeds were generated for failed migrations:\n');
      for (const seed of report.rollbackSeeds) {
        lines.push('### Version ' + seed.version + ' - Rollback Seed');
        lines.push('```json');
        lines.push(JSON.stringify(seed.data, null, 2));
        lines.push('```\n');
      }
    }

    if (report.errors && report.errors.length > 0) {
      lines.push('## Errors\n');
      for (const err of report.errors) {
        lines.push('- **Version ' + err.version + ':** ' + err.error);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  generateSummary(report) {
    return {
      generatedAt: report.generatedAt,
      fromVersion: report.fromVersion,
      toVersion: report.toVersion,
      success: report.success,
      totalSnapshots: report.totalSnapshots,
      successful: report.successful,
      failed: report.failed,
      skippedVersions: report.skippedVersions || [],
      totalSteps: report.totalSteps,
      rollbacksTriggered: report.rollbacksTriggered,
      versionChain: report.versionChain,
      errors: report.errors || [],
      fieldChanges: report.fieldChanges || {}
    };
  }

  export(report) {
    const mdReport = this.generateMarkdown(report);
    const mdPath = path.join(this.outputDir, 'migration_report.md');
    fs.writeFileSync(mdPath, mdReport, 'utf-8');

    const summary = this.generateSummary(report);
    const jsonPath = path.join(this.outputDir, 'summary.json');
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');

    if (report.rollbackSeeds && report.rollbackSeeds.length > 0) {
      const rollbackPath = path.join(this.outputDir, 'rollback_seeds.json');
      fs.writeFileSync(rollbackPath, JSON.stringify(report.rollbackSeeds, null, 2), 'utf-8');
    }

    return {
      reportPath: mdPath,
      summaryPath: jsonPath,
      rollbackPath: report.rollbackSeeds?.length > 0 ? path.join(this.outputDir, 'rollback_seeds.json') : null
    };
  }
}

module.exports = ReportExporter;
