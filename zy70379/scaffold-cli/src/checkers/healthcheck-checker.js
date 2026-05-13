const fs = require('fs');
const path = require('path');
const BaseChecker = require('./base-checker');

class HealthcheckChecker extends BaseChecker {
  check() {
    const issues = [];
    const srcDir = path.join(this.projectPath, 'src');

    const expectedPath = this.template.healthcheck?.http?.path;
    if (!expectedPath) return issues;

    if (fs.existsSync(srcDir)) {
      const files = this.getAllFiles(srcDir);
      let foundHealthcheck = false;
      let foundPath = null;

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const patterns = [
          new RegExp(`['"]${expectedPath.replace(/\//g, '\\/')}['"]`),
          new RegExp(`\\.get\\(\\s*['"]${expectedPath.replace(/\//g, '\\/')}`),
          new RegExp(`app\\.(get|post|all)\\(\\s*['"]${expectedPath.replace(/\//g, '\\/')}`)
        ];

        const otherPaths = content.match(/app\.(get|post|all)\(\s*['"]([^'"]+)['"]/g);
        if (otherPaths && !foundPath) {
          const match = otherPaths.find(p => p.includes('health'));
          if (match) {
            const pathMatch = match.match(/['"]([^'"]+)['"]/);
            if (pathMatch && pathMatch[1] !== expectedPath) {
              foundPath = pathMatch[1];
            }
          }
        }

        if (patterns.some(p => p.test(content))) {
          foundHealthcheck = true;
        }
      }

      if (!foundHealthcheck) {
        if (foundPath) {
          issues.push(this.createIssue(
            'healthcheck',
            `健康检查路径不一致，期望 ${expectedPath}，实际 ${foundPath}`,
            {
              expectedPath,
              actualPath: foundPath
            }
          ));
        } else {
          issues.push(this.createIssue(
            'healthcheck',
            `未找到健康检查端点 ${expectedPath}，请确保服务暴露了该端点`,
            {
              expectedPath,
              actualPath: null
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

module.exports = HealthcheckChecker;
