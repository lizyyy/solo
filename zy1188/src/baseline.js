'use strict';

const fs = require('fs-extra');
const path = require('path');

class BaselineManager {
  constructor(baselinePath = '.sql-scan-baseline.json') {
    this.baselinePath = path.resolve(baselinePath);
  }

  exists() {
    return fs.existsSync(this.baselinePath);
  }

  load() {
    if (!this.exists()) {
      return {
        version: '1.0',
        createdAt: new Date().toISOString(),
        ignored: [],
        metadata: {}
      };
    }

    const content = fs.readFileSync(this.baselinePath, 'utf-8');
    const baseline = JSON.parse(content);

    if (!baseline.ignored) {
      baseline.ignored = [];
    }

    return baseline;
  }

  async save(baseline) {
    baseline.updatedAt = new Date().toISOString();
    const content = JSON.stringify(baseline, null, 2);
    await fs.writeFile(this.baselinePath, content, 'utf-8');
  }

  async createFromResults(scanResults, outputPath = null) {
    const baseline = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      scanMetadata: {
        scanTime: scanResults.metadata.scanTime,
        codeDirectory: scanResults.metadata.codeDirectory,
        scannerVersion: scanResults.metadata.scannerVersion
      },
      ignored: [],
      notes: '此Baseline基于自动扫描结果创建。请仔细审查每个忽略项是否安全。'
    };

    for (const issue of scanResults.issues) {
      baseline.ignored.push({
        id: issue.id,
        name: issue.name,
        severity: issue.severity,
        file: issue.filePath,
        line: issue.lineNumber,
        matchedText: issue.matchedText,
        reason: '自动添加到Baseline - 请审查并更新原因',
        addedAt: new Date().toISOString(),
        reviewStatus: 'pending'
      });
    }

    const savePath = outputPath ? path.resolve(outputPath) : this.baselinePath;
    const originalPath = this.baselinePath;
    this.baselinePath = savePath;
    await this.save(baseline);
    this.baselinePath = originalPath;

    return baseline;
  }

  addIgnore(baseline, filePath, lineNumber, reason = '') {
    const existingIndex = baseline.ignored.findIndex(item => 
      item.file === filePath && item.line === lineNumber
    );

    if (existingIndex >= 0) {
      if (reason) {
        baseline.ignored[existingIndex].reason = reason;
      }
      return false;
    }

    baseline.ignored.push({
      file: filePath,
      line: lineNumber,
      reason: reason || '手动添加',
      addedAt: new Date().toISOString(),
      reviewStatus: 'approved'
    });

    return true;
  }

  removeIgnore(baseline, filePath, lineNumber) {
    const initialLength = baseline.ignored.length;
    baseline.ignored = baseline.ignored.filter(item => 
      !(item.file === filePath && item.line === lineNumber)
    );
    return baseline.ignored.length < initialLength;
  }

  _shouldIgnoreIssue(issue, baseline) {
    if (!baseline || !baseline.ignored || baseline.ignored.length === 0) {
      return false;
    }

    for (const ignored of baseline.ignored) {
      if (ignored.id && ignored.id === issue.id) {
        if (ignored.file && ignored.line) {
          if (ignored.file === issue.filePath && ignored.line === issue.lineNumber) {
            return true;
          }
        } else {
          return true;
        }
      }

      if (ignored.file === issue.filePath && ignored.line === issue.lineNumber) {
        return true;
      }

      if (ignored.file === issue.filePath && !ignored.line) {
        return true;
      }
    }

    return false;
  }

  filterResults(scanResults, baseline) {
    if (!baseline || !baseline.ignored || baseline.ignored.length === 0) {
      return scanResults;
    }

    const filteredIssues = scanResults.issues.filter(issue => 
      !this._shouldIgnoreIssue(issue, baseline)
    );

    const ignoredCount = scanResults.issues.length - filteredIssues.length;

    const newStats = { ...scanResults.stats };
    newStats.totalIssues = filteredIssues.length;
    
    newStats.bySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    newStats.byType = {};
    newStats.byFile = {};

    for (const issue of filteredIssues) {
      newStats.bySeverity[issue.severity]++;
      
      if (!newStats.byType[issue.id]) {
        newStats.byType[issue.id] = {
          name: issue.name,
          count: 0,
          severity: issue.severity
        };
      }
      newStats.byType[issue.id].count++;

      if (!newStats.byFile[issue.filePath]) {
        newStats.byFile[issue.filePath] = 0;
      }
      newStats.byFile[issue.filePath]++;
    }

    newStats.issuesPerFile = filteredIssues.length / (newStats.totalFiles || 1) || 0;
    newStats.riskScore = 
      newStats.bySeverity.critical * 100 +
      newStats.bySeverity.high * 50 +
      newStats.bySeverity.medium * 20 +
      newStats.bySeverity.low * 5;

    return {
      ...scanResults,
      stats: newStats,
      issues: filteredIssues,
      baselineApplied: true,
      ignoredCount: ignoredCount
    };
  }

  validate(baseline) {
    const errors = [];
    const warnings = [];

    if (!baseline.version) {
      warnings.push('缺少版本号字段');
    }

    if (!Array.isArray(baseline.ignored)) {
      errors.push('ignored 字段必须是数组');
      return { valid: false, errors, warnings };
    }

    for (let i = 0; i < baseline.ignored.length; i++) {
      const item = baseline.ignored[i];
      const index = i + 1;

      if (!item.file && !item.id) {
        warnings.push(`忽略项 #${index}: 缺少文件路径或问题ID，可能无法正确匹配`);
      }

      if (item.reviewStatus === 'pending') {
        warnings.push(`忽略项 #${index}: 状态为 "pending"，需要审查`);
      }

      if (!item.reason || item.reason.includes('自动添加') || item.reason.includes('请审查')) {
        warnings.push(`忽略项 #${index}: 原因描述不够明确，建议更新为具体的安全理由`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async merge(baseline1, baseline2) {
    const merged = {
      version: '1.0',
      createdAt: baseline1.createdAt || new Date().toISOString(),
      mergedAt: new Date().toISOString(),
      ignored: []
    };

    const seen = new Set();

    for (const item of [...(baseline1.ignored || []), ...(baseline2.ignored || [])]) {
      const key = item.id 
        ? `${item.id}:${item.file || ''}:${item.line || ''}`
        : `${item.file}:${item.line}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        merged.ignored.push(item);
      }
    }

    return merged;
  }
}

module.exports = BaselineManager;
