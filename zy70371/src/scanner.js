const fs = require('fs');
const path = require('path');
const { RULES, detectRedacted, generateMatchId, applyReplacement, getRiskLevel } = require('./rules');

const TARGET_EXTENSIONS = ['.json', '.csv', '.log', '.md', '.markdown'];
const LARGE_FILE_SIZE = 10 * 1024 * 1024;
const SAMPLE_LINES = 1000;
const BINARY_CHECK_BYTES = 8192;

function isBinaryFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(BINARY_CHECK_BYTES);
    const bytesRead = fs.readSync(fd, buffer, 0, BINARY_CHECK_BYTES, 0);
    fs.closeSync(fd);
    
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0x00) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function getFileInfo(filePath) {
  const stats = fs.statSync(filePath);
  return {
    path: filePath,
    size: stats.size,
    mtime: stats.mtimeMs,
    isLarge: stats.size > LARGE_FILE_SIZE
  };
}

function readLargeFileByLines(filePath, callback) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  if (lines.length > SAMPLE_LINES * 2) {
    const headSample = lines.slice(0, SAMPLE_LINES);
    const tailSample = lines.slice(-SAMPLE_LINES);
    const sample = [...headSample, ...tailSample];
    
    let lineNum = 1;
    for (const line of headSample) {
      callback(line, lineNum);
      lineNum++;
    }
    
    lineNum = lines.length - SAMPLE_LINES + 1;
    for (const line of tailSample) {
      callback(line, lineNum);
      lineNum++;
    }
  } else {
    let lineNum = 1;
    for (const line of lines) {
      callback(line, lineNum);
      lineNum++;
    }
  }
}

function readFileLines(filePath, callback) {
  const fileInfo = getFileInfo(filePath);
  
  if (fileInfo.isLarge) {
    readLargeFileByLines(filePath, callback);
    return true;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let lineNum = 1;
  for (const line of lines) {
    callback(line, lineNum);
    lineNum++;
  }
  return false;
}

function isContextRedacted(line, matchStart, matchEnd) {
  const contextStart = Math.max(0, matchStart - 5);
  const contextEnd = Math.min(line.length, matchEnd + 10);
  const context = line.substring(contextStart, contextEnd);
  
  return detectRedacted(context);
}

function scanLine(line, lineNumber, filePath, seenMatches) {
  const matches = [];
  
  for (const [ruleName, rule] of Object.entries(RULES)) {
    rule.pattern.lastIndex = 0;
    
    let match;
    while ((match = rule.pattern.exec(line)) !== null) {
      const matchedText = match[0];
      
      if (!rule.validator(matchedText)) continue;
      
      const matchId = generateMatchId(filePath, lineNumber, matchedText, ruleName);
      
      if (seenMatches.has(matchId)) continue;
      seenMatches.add(matchId);
      
      const isSelfRedacted = detectRedacted(matchedText);
      const isContextRedactedFlag = isContextRedacted(line, match.index, match.index + matchedText.length);
      const isRedacted = isSelfRedacted || isContextRedactedFlag;
      
      matches.push({
        id: matchId,
        ruleName: ruleName,
        type: rule.name,
        category: rule.category,
        match: matchedText,
        lineNumber: lineNumber,
        column: match.index + 1,
        riskLevel: isRedacted ? 'low' : getRiskLevel(ruleName),
        isRedacted: isRedacted,
        replacement: applyReplacement(matchedText, rule.replacement),
        context: line.substring(Math.max(0, match.index - 30), Math.min(line.length, match.index + matchedText.length + 30))
      });
    }
  }
  
  return matches;
}

function scanFile(filePath, ignoredRules = new Set(), seenMatches = new Set()) {
  const results = {
    filePath: filePath,
    isBinary: false,
    isLarge: false,
    matches: [],
    error: null
  };
  
  try {
    if (isBinaryFile(filePath)) {
      results.isBinary = true;
      return results;
    }
    
    const fileInfo = getFileInfo(filePath);
    results.isLarge = fileInfo.isLarge;
    
    readFileLines(filePath, (line, lineNum) => {
      const lineMatches = scanLine(line, lineNum, filePath, seenMatches);
      for (const match of lineMatches) {
        if (!ignoredRules.has(match.id)) {
          results.matches.push(match);
        }
      }
    });
    
  } catch (error) {
    results.error = error.message;
  }
  
  return results;
}

function shouldScanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TARGET_EXTENSIONS.includes(ext);
}

function findFilesRecursive(dirPath) {
  const files = [];
  
  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      if (entry.name === 'node_modules') continue;
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && shouldScanFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dirPath);
  return files;
}

function scanDirectory(dirPath, stateManager = null) {
  const files = findFilesRecursive(dirPath);
  const results = [];
  const seenMatches = new Set();
  
  const ignoredRules = stateManager ? stateManager.getActiveIgnoreIds() : new Set();
  
  for (const filePath of files) {
    const fileResult = scanFile(filePath, ignoredRules, seenMatches);
    results.push(fileResult);
  }
  
  return results;
}

module.exports = {
  scanFile,
  scanDirectory,
  findFilesRecursive,
  getFileInfo,
  isBinaryFile,
  shouldScanFile,
  LARGE_FILE_SIZE
};