const fs = require('fs');
const path = require('path');
const BaseChecker = require('./base-checker');

class LoggingChecker extends BaseChecker {
  check() {
    const issues = [];
    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return issues;
    }

    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    } catch (e) {
      return issues;
    }

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    const expectedLogging = this.template.logging || {};

    const hasWinston = 'winston' in deps;
    const hasPino = 'pino' in deps;
    const hasBunyan = 'bunyan' in deps;
    const hasMorgan = 'morgan' in deps;
    const usesConsoleOnly = !hasWinston && !hasPino && !hasBunyan;

    if (expectedLogging.format === 'json' && hasMorgan) {
      issues.push(this.createIssue(
        'logging',
        '检测到使用 morgan（文本日志格式），期望使用 JSON 格式日志',
        {
          expected: { format: 'json', library: 'winston/pino' },
          actual: { library: 'morgan' }
        }
      ));
    }

    if (usesConsoleOnly && !hasMorgan) {
      issues.push(this.createIssue(
        'logging',
        '未检测到结构化日志库，建议使用 winston 或 pino',
        {
          expected: { library: 'winston' },
          actual: { library: 'console.log' }
        }
      ));
    }

    if (hasWinston) {
      const srcDir = path.join(this.projectPath, 'src');
      if (fs.existsSync(srcDir)) {
        const files = this.getAllFiles(srcDir);
        let hasJsonFormat = false;
        let usesStdout = false;

        for (const file of files) {
          const content = fs.readFileSync(file, 'utf-8');
          if (/format\.json/.test(content) || /format:.*json/.test(content)) {
            hasJsonFormat = true;
          }
          if (/transports\.Console/.test(content) || /Console\(\)/.test(content)) {
            usesStdout = true;
          }
        }

        if (!hasJsonFormat && expectedLogging.format === 'json') {
          issues.push(this.createIssue(
            'logging',
            'winston 未配置为 JSON 格式',
            {
              expected: { format: 'json' },
              actual: { format: 'unknown' }
            }
          ));
        }

        if (!usesStdout && expectedLogging.destination === 'stdout') {
          issues.push(this.createIssue(
            'logging',
            '日志未输出到 stdout（控制台），建议使用 Console transport',
            {
              expected: { destination: 'stdout' },
              actual: { destination: 'unknown' }
            }
          ));
        }
      }
    }

    return issues;
  }

  getAllFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        files = files.concat(this.getAllFiles(fullPath));
      } else if (/\.(js|ts)$/.test(item)) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

module.exports = LoggingChecker;
