const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const { shouldIgnore } = require('./config');

function findFiles(baseDir, config) {
  const { fileExtensions } = config;
  const files = [];
  const pattern = `**/*{${fileExtensions.join(',')}}`;

  try {
    const allFiles = globSync(pattern, {
      cwd: baseDir,
      absolute: true,
      nodir: true,
      dot: false
    });

    for (const filePath of allFiles) {
      if (!shouldIgnore(filePath, config, baseDir)) {
        files.push(filePath);
      }
    }
  } catch (error) {
    throw new Error(`扫描文件失败: ${error.message}`);
  }

  return files;
}

function readFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      filePath,
      content,
      lines: content.split('\n')
    };
  } catch (error) {
    throw new Error(`无法读取文件 ${filePath}: ${error.message}`);
  }
}

function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

function isHtmlFile(filePath) {
  return ['.html'].includes(getFileExtension(filePath));
}

function isJsxTsxFile(filePath) {
  return ['.jsx', '.tsx'].includes(getFileExtension(filePath));
}

function isCssFile(filePath) {
  return ['.css'].includes(getFileExtension(filePath));
}

function findLineNumber(lines, pattern, startFromLine = 0) {
  for (let i = startFromLine; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return startFromLine + 1;
}

function findNearbyCode(lines, lineNumber, context = 2) {
  const start = Math.max(0, lineNumber - 1 - context);
  const end = Math.min(lines.length, lineNumber + context);
  return lines.slice(start, end).join('\n');
}

module.exports = {
  findFiles,
  readFileContent,
  getFileExtension,
  isHtmlFile,
  isJsxTsxFile,
  isCssFile,
  findLineNumber,
  findNearbyCode
};
