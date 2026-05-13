import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '.tit-data');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getFilePath(filename) {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, filename);
}

export function loadConfig(configPath) {
  const absolutePath = path.isAbsolute(configPath) 
    ? configPath 
    : path.join(process.cwd(), configPath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`配置文件不存在: ${absolutePath}`);
  }
  
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content);
}

export function loadResults() {
  const filePath = getFilePath('results.json');
  if (!fs.existsSync(filePath)) {
    return { runs: [], markedFixed: [] };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function saveResults(data) {
  const filePath = getFilePath('results.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function addRun(runData) {
  const results = loadResults();
  results.runs.push(runData);
  saveResults(results);
  return results.runs.length - 1;
}

export function getLatestRun() {
  const results = loadResults();
  if (results.runs.length === 0) return null;
  return results.runs[results.runs.length - 1];
}

export function getRun(index) {
  const results = loadResults();
  if (index < 0 || index >= results.runs.length) return null;
  return results.runs[index];
}

export function markFixed(issueId, note = '') {
  const results = loadResults();
  results.markedFixed.push({
    issueId,
    note,
    markedAt: new Date().toISOString(),
  });
  saveResults(results);
}

export function isMarkedFixed(issueId) {
  const results = loadResults();
  return results.markedFixed.some(m => m.issueId === issueId);
}

export function getMarkedFixed() {
  const results = loadResults();
  return results.markedFixed;
}
