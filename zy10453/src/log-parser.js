const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class LogParser {
  constructor(args) {
    this.args = args;
    this.matrixKeys = args.matrixKeys;
  }

  async parseDirectory() {
    if (!this.args.logsDir) {
      return [];
    }

    const logFiles = this.findLogFiles(this.args.logsDir);
    if (logFiles.length === 0) {
      throw new Error(`在目录 ${this.args.logsDir} 中未找到日志文件`);
    }

    if (this.args.verbose) {
      console.log(chalk.blue(`找到 ${logFiles.length} 个日志文件`));
    }

    const results = [];
    for (const file of logFiles) {
      try {
        const parsed = await this.parseFile(file);
        results.push(parsed);
      } catch (e) {
        console.warn(chalk.yellow(`警告: 无法解析 ${file}: ${e.message}`));
      }
    }

    return results;
  }

  findLogFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.findLogFiles(fullPath));
      } else if (this.isLogFile(entry)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  isLogFile(filename) {
    return /\.(log|txt)$/i.test(filename) || filename.includes('job') || filename.includes('run');
  }

  async parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    return {
      filePath,
      fileName: path.basename(filePath),
      matrix: this.extractMatrixParams(lines),
      status: this.detectStatus(lines),
      failureSnippets: this.extractFailureSnippets(lines, filePath),
      rerunCount: this.detectRerunCount(lines),
      timestamps: this.extractTimestamps(lines),
      rawContent: content
    };
  }

  extractMatrixParams(lines) {
    const matrix = {};

    for (const key of this.matrixKeys) {
      const patterns = [
        new RegExp(`matrix\\.${key}\\s*=\\s*([^\n]+)`, 'i'),
        new RegExp(`${key}\\s*[:=]\\s*([^\\s,\\n]+)`, 'i'),
        new RegExp(`\\[${key}:\\s*([^\\]]+)\\]`, 'i'),
        new RegExp(`::set-output::${key}=([^\n]+)`, 'i')
      ];

      for (const pattern of patterns) {
        for (const line of lines) {
          const match = line.match(pattern);
          if (match) {
            matrix[key] = match[1].trim();
            break;
          }
        }
        if (matrix[key]) break;
      }
    }

    if (Object.keys(matrix).length === 0) {
      const fallback = this.guessMatrixFromFilename(lines[0] || '');
      Object.assign(matrix, fallback);
    }

    return matrix;
  }

  guessMatrixFromFilename(firstLine) {
    const matrix = {};
    const osPatterns = ['ubuntu', 'windows', 'macos', 'linux'];
    const nodePatterns = ['node', 'nodejs', 'v\\d+'];

    for (const os of osPatterns) {
      if (firstLine.toLowerCase().includes(os)) {
        matrix.os = os;
        break;
      }
    }

    const nodeMatch = firstLine.match(/node.*?(\d+\.\d+|\d+)/i);
    if (nodeMatch) {
      matrix['node-version'] = nodeMatch[1];
    }

    return matrix;
  }

  detectStatus(lines) {
    const content = lines.join('\n');
    if (/error|failed|failure|exit code 1/i.test(content)) {
      return 'failed';
    }
    if (/success|completed|done/i.test(content)) {
      return 'success';
    }
    return 'unknown';
  }

  extractFailureSnippets(lines, filePath) {
    const snippets = [];
    const errorPatterns = [
      /error:.*/i,
      /failed:.*/i,
      /traceback[\s\S]*?(?=\n\n|\n\s*\n|$)/i,
      /npm err!.*$/i,
      /AssertionError.*/i,
      /exit code 1.*/i
    ];

    lines.forEach((line, index) => {
      for (const pattern of errorPatterns) {
        if (pattern.test(line)) {
          const start = Math.max(0, index - 3);
          const end = Math.min(lines.length, index + 5);
          snippets.push({
            lineNumber: index + 1,
            filePath,
            pattern: pattern.toString(),
            snippet: lines.slice(start, end + 1).join('\n').trim()
          });
          break;
        }
      }
    });

    return snippets.slice(0, 10);
  }

  detectRerunCount(lines) {
    const content = lines.join('\n');
    const rerunMatches = content.match(/re[-]?run|attempt.*#(\d+)/gi);
    if (rerunMatches) {
      return rerunMatches.length;
    }
    return 0;
  }

  extractTimestamps(lines) {
    const timestamps = [];
    const timestampPattern = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})|(\d{2}:\d{2}:\d{2})/;

    lines.forEach((line, index) => {
      const match = line.match(timestampPattern);
      if (match) {
        timestamps.push({
          lineNumber: index + 1,
          timestamp: match[0]
        });
      }
    });

    return timestamps;
  }
}

module.exports = { LogParser };
