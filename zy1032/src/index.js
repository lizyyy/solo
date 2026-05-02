const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config');
const { findFiles, readFileContent } = require('./file-finder');
const { parseFile } = require('./parser');
const { checkAll } = require('./rules');

let lastScanResult = null;
let lastScanConfig = null;

function scanDirectory(targetDir, options = {}) {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`目录不存在: ${targetDir}`);
  }
  
  const stats = fs.statSync(targetDir);
  if (!stats.isDirectory()) {
    throw new Error(`不是一个目录: ${targetDir}`);
  }
  
  const config = loadConfig(targetDir, options.configPath);
  
  const files = findFiles(targetDir, config);
  
  if (files.length === 0) {
    console.warn(`⚠️ 在目录 ${targetDir} 中没有找到可扫描的文件`);
    console.warn(`   支持的扩展名: ${config.fileExtensions.join(', ')}`);
    console.warn(`   被忽略的模式: ${config.ignorePatterns.join(', ')}`);
    return {
      issues: [],
      targetDir,
      config,
      filesScanned: 0
    };
  }
  
  console.log(`📂 找到 ${files.length} 个文件等待扫描...`);
  
  const allIssues = [];
  let filesScanned = 0;
  
  for (const filePath of files) {
    try {
      const fileData = readFileContent(filePath);
      const parsedData = parseFile(fileData);
      
      if (parsedData.type !== 'unknown') {
        const issues = checkAll(parsedData, config);
        allIssues.push(...issues);
        filesScanned++;
      }
    } catch (error) {
      console.warn(`⚠️ 扫描文件 ${filePath} 时出错: ${error.message}`);
    }
  }
  
  lastScanResult = allIssues;
  lastScanConfig = { targetDir, config };
  
  return {
    issues: allIssues,
    targetDir,
    config,
    filesScanned
  };
}

function getLastScanResult() {
  return {
    issues: lastScanResult,
    ...lastScanConfig
  };
}

function hasLastScanResult() {
  return lastScanResult !== null;
}

function clearScanResult() {
  lastScanResult = null;
  lastScanConfig = null;
}

module.exports = {
  scanDirectory,
  getLastScanResult,
  hasLastScanResult,
  clearScanResult
};
