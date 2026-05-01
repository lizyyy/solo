const fs = require('fs');
const path = require('path');

class ReportExporter {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  export(findings, metadata) {
    this.ensureOutputDir();

    const findingsPath = path.join(this.outputDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify(findings, null, 2));

    const reportPath = path.join(this.outputDir, 'report.md');
    fs.writeFileSync(reportPath, this.generateMarkdown(findings, metadata));

    const checklistPath = path.join(this.outputDir, 'checklist.txt');
    fs.writeFileSync(checklistPath, this.generateChecklist(findings));

    return {
      findingsPath,
      reportPath,
      checklistPath
    };
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateMarkdown(findings, metadata) {
    const timestamp = new Date().toISOString();
    const errors = findings.filter(f => f.severity === 'error');
    const warnings = findings.filter(f => f.severity === 'warning');

    let md = `# Extension Publishing Pre-Check Report\n\n`;
    md += `**Generated:** ${timestamp}\n\n`;
    md += `**Extension:** ${metadata?.extDir || 'Unknown'}\n`;
    md += `**Version:** ${metadata?.version || 'Unknown'}\n`;
    md += `**Manifest Version:** ${metadata?.manifestVersion || 'Unknown'}\n\n`;

    md += `## Summary\n\n`;
    md += `| Severity | Count |\n`;
    md += `|----------|-------|\n`;
    md += `| Errors   | ${errors.length} |\n`;
    md += `| Warnings | ${warnings.length} |\n\n`;

    if (errors.length === 0 && warnings.length === 0) {
      md += `✅ **No issues found. Extension is ready for publishing!**\n\n`;
      return md;
    }

    if (errors.length > 0) {
      md += `## 🔴 Errors\n\n`;
      for (const finding of errors) {
        md += this.formatFinding(finding);
      }
      md += `\n`;
    }

    if (warnings.length > 0) {
      md += `## 🟡 Warnings\n\n`;
      for (const finding of warnings) {
        md += this.formatFinding(finding);
      }
      md += `\n`;
    }

    md += `## Actionable Checklist\n\n`;
    md += this.formatChecklist(findings);

    return md;
  }

  formatFinding(finding) {
    let str = `### ${finding.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
    str += `- **Message:** ${finding.message}\n`;
    str += `- **Location:** \`${finding.location}\`\n`;
    str += `- **Suggestion:** ${finding.suggestion}\n\n`;
    return str;
  }

  formatChecklist(findings) {
    let checklist = '';

    const grouped = {};
    for (const f of findings) {
      if (!grouped[f.type]) {
        grouped[f.type] = [];
      }
      grouped[f.type].push(f);
    }

    for (const [type, items] of Object.entries(grouped)) {
      checklist += `#### ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
      for (const item of items) {
        checklist += `- [ ] ${item.suggestion} (${item.location})\n`;
      }
      checklist += `\n`;
    }

    return checklist;
  }

  generateChecklist(findings) {
    let checklist = 'EXTENSION PUBLISHING FIX CHECKLIST\n';
    checklist += '=' .repeat(40) + '\n\n';

    const grouped = {};
    for (const f of findings) {
      if (!grouped[f.severity]) {
        grouped[f.severity] = [];
      }
      grouped[f.severity].push(f);
    }

    if (grouped.error) {
      checklist += 'ERRORS (Must fix before publishing):\n';
      checklist += '-'.repeat(40) + '\n';
      for (const f of grouped.error) {
        checklist += `[ ] ${f.suggestion}\n`;
        checklist += `    Location: ${f.location}\n`;
      }
      checklist += '\n';
    }

    if (grouped.warning) {
      checklist += 'WARNINGS (Should fix before publishing):\n';
      checklist += '-'.repeat(40) + '\n';
      for (const f of grouped.warning) {
        checklist += `[ ] ${f.suggestion}\n`;
        checklist += `    Location: ${f.location}\n`;
      }
      checklist += '\n';
    }

    checklist += 'STATUS: [ ] All items checked above are resolved\n';
    checklist += 'VERIFIED BY: ___________________\n';
    checklist += 'DATE: ___________________\n';

    return checklist;
  }
}

module.exports = ReportExporter;
