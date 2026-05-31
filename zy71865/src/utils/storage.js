const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const PATHS = {
  raw: path.join(DATA_DIR, 'raw'),
  processed: path.join(DATA_DIR, 'processed'),
  exports: path.join(DATA_DIR, 'exports'),
  history: path.join(DATA_DIR, 'history')
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureAllDirs() {
  Object.values(PATHS).forEach(ensureDir);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`JSON解析失败: ${filePath} - ${e.message}`);
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function listFiles(dirPath, pattern = null) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  let files = fs.readdirSync(dirPath);
  if (pattern) {
    const regex = new RegExp(pattern);
    files = files.filter(f => regex.test(f));
  }
  return files.map(f => path.join(dirPath, f));
}

function getFilePath(type, filename) {
  const dir = PATHS[type] || DATA_DIR;
  return path.join(dir, filename);
}

function getProjectFiles(projectName) {
  return {
    questionBank: getFilePath('processed', `${projectName}-questions.json`),
    mistakes: getFilePath('processed', `${projectName}-mistakes.json`),
    reviewScript: getFilePath('processed', `${projectName}-review-script.json`),
    history: getFilePath('history', `${projectName}-history.json`)
  };
}

function listProjects() {
  const files = listFiles(PATHS.processed, '-questions\\.json$');
  return files.map(f => {
    const name = path.basename(f).replace('-questions.json', '');
    return name;
  });
}

module.exports = {
  PATHS,
  ensureDir,
  ensureAllDirs,
  readJson,
  writeJson,
  readFile,
  writeFile,
  fileExists,
  listFiles,
  getFilePath,
  getProjectFiles,
  listProjects
};
