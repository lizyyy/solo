const fs = require('fs');
const path = require('path');

const SEVERITY_ORDER = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0
};

class Scanner {
  constructor(rules) {
    this.rules = rules || [];
    this.compiledRules = this.rules.map(r => ({
      rule: r,
      regex: new RegExp(r.pattern, 'gi')
    }));
  }

  setRules(rules) {
    this.rules = rules;
    this.compiledRules = this.rules.map(r => ({
      rule: r,
      regex: new RegExp(r.pattern, 'gi')
    }));
  }

  scanText(text, source = 'input') {
    const findings = [];

    for (const { rule, regex } of this.compiledRules) {
      let match;
      regex.lastIndex = 0;

      while ((match = regex.exec(text)) !== null) {
        const lineNum = this.getLineNumber(text, match.index);
        const columnNum = this.getColumnNumber(text, match.index);
        const lineContent = this.getLineContent(text, lineNum);

        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          blockCode: rule.blockCode,
          match: match[0],
          source,
          line: lineNum,
          column: columnNum,
          lineContent,
          description: rule.description,
          severityOrder: SEVERITY_ORDER[rule.severity] || 0
        });

        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    }

    findings.sort((a, b) => b.severityOrder - a.severityOrder);

    return {
      success: true,
      findings,
      stats: this.calculateStats(findings)
    };
  }

  scanFile(filePath) {
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: '文件不存在',
        filePath: fullPath
      };
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return this.scanDirectory(fullPath);
    }

    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch (e) {
      return {
        success: false,
        error: '文件读取失败',
        filePath: fullPath,
        details: e.message
      };
    }

    const result = this.scanText(content, fullPath);
    result.filePath = fullPath;

    return result;
  }

  scanDirectory(dirPath, extensions = null) {
    const fullDir = path.resolve(dirPath);

    if (!fs.existsSync(fullDir)) {
      return {
        success: false,
        error: '目录不存在',
        dirPath: fullDir
      };
    }

    const allFindings = [];
    const scannedFiles = [];
    const errors = [];

    const files = this.listFiles(fullDir, extensions);

    for (const file of files) {
      const result = this.scanFile(file);
      if (result.success) {
        scannedFiles.push(file);
        allFindings.push(...result.findings);
      } else {
        errors.push(result);
      }
    }

    return {
      success: true,
      dirPath: fullDir,
      scannedFiles,
      fileCount: scannedFiles.length,
      findings: allFindings,
      errors,
      stats: this.calculateStats(allFindings)
    };
  }

  listFiles(dirPath, extensions = null) {
    const results = [];

    const walk = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (file !== 'node_modules' && file !== '.git') {
            walk(fullPath);
          }
        } else {
          if (!extensions || extensions.some(ext => file.endsWith(ext))) {
            results.push(fullPath);
          }
        }
      }
    };

    walk(dirPath);
    return results;
  }

  getLineNumber(text, index) {
    const lines = text.substring(0, index).split('\n');
    return lines.length;
  }

  getColumnNumber(text, index) {
    const lines = text.substring(0, index).split('\n');
    return lines[lines.length - 1].length + 1;
  }

  getLineContent(text, lineNum) {
    const lines = text.split('\n');
    return lines[lineNum - 1] || '';
  }

  calculateStats(findings) {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: findings.length,
      byRule: {},
      blockCodes: []
    };

    for (const f of findings) {
      stats[f.severity]++;
      stats.byRule[f.ruleId] = (stats.byRule[f.ruleId] || 0) + 1;
      if (!stats.blockCodes.includes(f.blockCode)) {
        stats.blockCodes.push(f.blockCode);
      }
    }

    stats.shouldBlock = stats.critical > 0 || stats.high > 0;

    return stats;
  }
}

module.exports = { Scanner, SEVERITY_ORDER };
