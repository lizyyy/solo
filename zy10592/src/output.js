const fs = require('fs');
const path = require('path');

function getTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .substring(0, 19);
}

function setupOutputDir(baseOutputDir, timestamp) {
  const absoluteBase = path.resolve(baseOutputDir);
  
  if (!fs.existsSync(absoluteBase)) {
    fs.mkdirSync(absoluteBase, { recursive: true });
  }
  
  const runOutputDir = path.join(absoluteBase, `run_${timestamp}`);
  
  if (fs.existsSync(runOutputDir)) {
    throw new Error(`输出目录已存在: ${runOutputDir}`);
  }
  
  fs.mkdirSync(runOutputDir, { recursive: true });
  
  return runOutputDir;
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

module.exports = {
  getTimestamp,
  setupOutputDir,
  writeFile
};
