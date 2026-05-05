'use strict';

const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');
const {
  DETECTION_PATTERNS,
  FILE_EXTENSIONS_TO_SCAN,
  FILES_TO_IGNORE,
  RISK_LEVELS,
  RISK_WEIGHTS,
  DATABASE_FILE_PATTERNS,
  DATABASE_RELATED_FILES
} = require('./patterns');
const DatabaseChecker = require('./database-checker');

class Scanner {
  constructor(options = {}) {
    this.codeDir = options.codeDir || process.cwd();
    this.databasePath = options.databasePath || null;
    this.minRiskLevel = options.minRiskLevel || 'low';
    this.includePatterns = options.includePatterns || FILE_EXTENSIONS_TO_SCAN;
    this.excludePatterns = options.excludePatterns || FILES_TO_IGNORE;
    this.customPatterns = options.customPatterns || [];
    
    this._validateOptions();
  }

  _validateOptions() {
    if (!fs.existsSync(this.codeDir)) {
      const error = new Error(`代码目录不存在: ${this.codeDir}`);
      error.code = 'ENOENT';
      error.path = this.codeDir;
      throw error;
    }

    if (!fs.statSync(this.codeDir).isDirectory()) {
      throw new Error(`指定的路径不是目录: ${this.codeDir}`);
    }

    if (this.databasePath && !fs.existsSync(this.databasePath)) {
      const error = new Error(`数据库文件不存在: ${this.databasePath}`);
      error.code = 'ENOENT';
      error.path = this.databasePath;
      throw error;
    }

    if (!['critical', 'high', 'medium', 'low'].includes(this.minRiskLevel)) {
      throw new Error(`无效的风险级别: ${this.minRiskLevel}，有效值为: critical, high, medium, low`);
    }
  }

  _shouldScanFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.includePatterns.includes(ext) && !this.includePatterns.includes('*')) {
      return false;
    }

    const relativePath = path.relative(this.codeDir, filePath);
    for (const pattern of this.excludePatterns) {
      if (pattern.endsWith('/')) {
        if (relativePath.includes(pattern) || relativePath.startsWith(pattern.replace('/', ''))) {
          return false;
        }
      } else if (pattern.startsWith('*')) {
        const suffix = pattern.slice(1);
        if (filePath.endsWith(suffix)) {
          return false;
        }
      } else if (relativePath === pattern || relativePath.includes('/' + pattern + '/')) {
        return false;
      }
    }

    return true;
  }

  async _getFilesToScan() {
    const globPatterns = this.includePatterns.map(ext => 
      ext === '*' ? '**/*' : `**/*${ext}`
    );

    const allFiles = [];
    for (const pattern of globPatterns) {
      const files = await glob(pattern, {
        cwd: this.codeDir,
        absolute: true,
        nodir: true,
        dot: false
      });
      allFiles.push(...files);
    }

    const uniqueFiles = [...new Set(allFiles)];
    return uniqueFiles.filter(file => this._shouldScanFile(file));
  }

  _extractCodeContext(lines, lineNumber, contextSize = 3) {
    const start = Math.max(0, lineNumber - contextSize - 1);
    const end = Math.min(lines.length, lineNumber + contextSize);
    
    const context = [];
    for (let i = start; i < end; i++) {
      context.push({
        lineNumber: i + 1,
        content: lines[i],
        isIssue: i === lineNumber - 1
      });
    }
    return context;
  }

  _findIssuesInLine(line, lineNumber, filePath, allPatterns) {
    const issues = [];
    
    for (const patternDef of allPatterns) {
      for (const pattern of patternDef.patterns) {
        pattern.lastIndex = 0;
        
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const matchedText = match[0];
          
          let hasSqlContext = false;
          if (patternDef.contextPattern) {
            patternDef.contextPattern.lastIndex = 0;
            if (patternDef.contextPattern.test(line)) {
              hasSqlContext = true;
            }
          } else {
            hasSqlContext = true;
          }

          if (!hasSqlContext) {
            const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'FROM', 'WHERE', 'JOIN', 'TABLE'];
            for (const keyword of sqlKeywords) {
              if (line.toUpperCase().includes(keyword)) {
                hasSqlContext = true;
                break;
              }
            }
          }

          if (hasSqlContext) {
            issues.push({
              id: patternDef.id,
              name: patternDef.name,
              severity: patternDef.severity,
              description: patternDef.description,
              filePath: filePath,
              lineNumber: lineNumber,
              column: match.index + 1,
              matchedText: matchedText,
              fixSuggestion: patternDef.fixSuggestion,
              examples: patternDef.examples
            });
          }
        }
      }
    }

    return issues;
  }

  async _scanFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const allPatterns = [...DETECTION_PATTERNS, ...this.customPatterns];
    const fileIssues = [];

    let multilineBuffer = '';
    let multilineStart = 0;
    let inMultilineString = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      if (line.includes('`') || inMultilineString) {
        const backtickCount = (line.match(/`/g) || []).length;
        
        if (backtickCount > 0) {
          if (!inMultilineString) {
            multilineStart = lineNumber;
            inMultilineString = true;
          }
          multilineBuffer += line + '\n';
          
          if (backtickCount % 2 === 0 || (backtickCount === 1 && inMultilineString && multilineBuffer.match(/`[^`]*`[^`]*$/))) {
            const issues = this._findIssuesInLine(multilineBuffer, multilineStart, filePath, allPatterns);
            for (const issue of issues) {
              issue.lineNumber = lineNumber;
              issue.multilineContext = this._extractCodeContext(lines, multilineStart, 5);
            }
            fileIssues.push(...issues);
            inMultilineString = false;
            multilineBuffer = '';
          }
        } else if (inMultilineString) {
          multilineBuffer += line + '\n';
        }
      }

      if (!inMultilineString) {
        const issues = this._findIssuesInLine(line, lineNumber, filePath, allPatterns);
        for (const issue of issues) {
          issue.context = this._extractCodeContext(lines, lineNumber);
        }
        fileIssues.push(...issues);
      }
    }

    if (inMultilineString && multilineBuffer) {
      const issues = this._findIssuesInLine(multilineBuffer, multilineStart, filePath, allPatterns);
      for (const issue of issues) {
        issue.multilineContext = this._extractCodeContext(lines, multilineStart, 5);
      }
      fileIssues.push(...issues);
    }

    return fileIssues;
  }

  _filterByRiskLevel(issues) {
    const minWeight = RISK_WEIGHTS[this.minRiskLevel];
    return issues.filter(issue => RISK_WEIGHTS[issue.severity] >= minWeight);
  }

  _deduplicateIssues(issues) {
    const seen = new Set();
    const unique = [];

    for (const issue of issues) {
      const key = `${issue.filePath}:${issue.lineNumber}:${issue.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(issue);
      }
    }

    return unique;
  }

  _calculateStats(files, issues) {
    const stats = {
      totalFiles: files.length,
      totalIssues: issues.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      byType: {},
      byFile: {}
    };

    for (const issue of issues) {
      stats.bySeverity[issue.severity]++;
      
      if (!stats.byType[issue.id]) {
        stats.byType[issue.id] = {
          name: issue.name,
          count: 0,
          severity: issue.severity
        };
      }
      stats.byType[issue.id].count++;

      if (!stats.byFile[issue.filePath]) {
        stats.byFile[issue.filePath] = 0;
      }
      stats.byFile[issue.filePath]++;
    }

    stats.issuesPerFile = issues.length / files.length || 0;
    stats.riskScore = 
      stats.bySeverity.critical * 100 +
      stats.bySeverity.high * 50 +
      stats.bySeverity.medium * 20 +
      stats.bySeverity.low * 5;

    return stats;
  }

  async _scanDatabaseFiles() {
    const dbIssues = [];
    const dbChecker = new DatabaseChecker();

    if (this.databasePath) {
      const issues = await dbChecker.checkDatabaseFile(this.databasePath);
      dbIssues.push(...issues);

      const relatedFiles = dbChecker.findRelatedFiles(this.databasePath);
      for (const relatedFile of relatedFiles) {
        const relatedIssues = await dbChecker.checkDatabaseFile(relatedFile);
        dbIssues.push(...relatedIssues);
      }
    }

    const patterns = [...DATABASE_FILE_PATTERNS, ...DATABASE_RELATED_FILES];
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.codeDir,
        absolute: true,
        nodir: true
      });

      for (const file of files) {
        if (this.databasePath && file === this.databasePath) {
          continue;
        }
        const issues = await dbChecker.checkDatabaseFile(file);
        dbIssues.push(...issues);
      }
    }

    return dbIssues;
  }

  async scan() {
    const startTime = Date.now();

    const filesToScan = await this._getFilesToScan();
    const allIssues = [];

    for (const file of filesToScan) {
      try {
        const issues = await this._scanFile(file);
        allIssues.push(...issues);
      } catch (error) {
        console.warn(`警告: 无法扫描文件 ${file}: ${error.message}`);
      }
    }

    try {
      const dbIssues = await this._scanDatabaseFiles();
      allIssues.push(...dbIssues);
    } catch (error) {
      console.warn(`警告: 数据库文件扫描失败: ${error.message}`);
    }

    const dedupedIssues = this._deduplicateIssues(allIssues);
    const filteredIssues = this._filterByRiskLevel(dedupedIssues);

    filteredIssues.sort((a, b) => {
      const weightDiff = RISK_WEIGHTS[b.severity] - RISK_WEIGHTS[a.severity];
      if (weightDiff !== 0) return weightDiff;
      
      if (a.filePath < b.filePath) return -1;
      if (a.filePath > b.filePath) return 1;
      
      return a.lineNumber - b.lineNumber;
    });

    const endTime = Date.now();
    const stats = this._calculateStats(filesToScan, filteredIssues);

    return {
      metadata: {
        scanTime: new Date().toISOString(),
        duration: endTime - startTime,
        codeDirectory: this.codeDir,
        databasePath: this.databasePath,
        minRiskLevel: this.minRiskLevel,
        scannerVersion: '1.0.0'
      },
      stats,
      issues: filteredIssues,
      filesScanned: filesToScan
    };
  }
}

module.exports = Scanner;
