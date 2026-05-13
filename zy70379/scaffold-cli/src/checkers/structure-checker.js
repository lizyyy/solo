const fs = require('fs');
const path = require('path');
const BaseChecker = require('./base-checker');

class StructureChecker extends BaseChecker {
  check() {
    const issues = [];

    issues.push(...this.checkRequiredFiles());
    issues.push(...this.checkDirectoryStructure());

    return issues;
  }

  checkRequiredFiles() {
    const issues = [];
    const requiredFiles = this.template.requiredFiles || [];

    for (const file of requiredFiles) {
      const filePath = path.join(this.projectPath, file);
      if (!fs.existsSync(filePath)) {
        issues.push(this.createIssue(
          'required-files',
          `缺少必需文件: ${file}`,
          { missingFile: file }
        ));
      }
    }

    return issues;
  }

  checkDirectoryStructure() {
    const issues = [];
    const expectedDirs = this.template.directoryStructure || [];

    for (const dir of expectedDirs) {
      const dirPath = path.join(this.projectPath, dir);
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        issues.push(this.createIssue(
          'directory-structure',
          `缺少标准目录: ${dir}`,
          {
            missingDirectory: dir,
            expected: dir,
            actual: null
          }
        ));
      }
    }

    return issues;
  }
}

module.exports = StructureChecker;
