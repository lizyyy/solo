const fs = require('fs');
const path = require('path');

function normalizePath(url) {
  if (!url) return '';
  
  let normalized = url;
  
  normalized = normalized.replace(/\\/g, '/');
  
  normalized = normalized.replace(/\/+/g, '/');
  
  const parts = normalized.split('/');
  const result = [];
  
  for (const part of parts) {
    if (part === '.' || part === '') {
      continue;
    } else if (part === '..') {
      if (result.length > 0 && result[result.length - 1] !== '..') {
        result.pop();
      } else {
        result.push('..');
      }
    } else {
      result.push(part);
    }
  }
  
  if (normalized.startsWith('/') && result.length > 0 && !result[0].startsWith('/')) {
    return '/' + result.join('/');
  }
  
  return result.join('/');
}

function resolveAssetPath(assetUrl, referrerPath, baseDir) {
  const normalizedUrl = normalizePath(assetUrl);
  const referrerDir = path.dirname(path.join(baseDir, referrerPath));
  
  let absolutePath;
  
  if (normalizedUrl.startsWith('/')) {
    absolutePath = path.join(baseDir, normalizedUrl);
  } else {
    absolutePath = path.join(referrerDir, normalizedUrl);
  }
  
  return {
    originalUrl: assetUrl,
    normalizedUrl: normalizedUrl,
    absolutePath: absolutePath,
    relativePath: path.relative(baseDir, absolutePath).replace(/\\/g, '/')
  };
}

function checkFileExists(absolutePath) {
  try {
    const stats = fs.statSync(absolutePath);
    return {
      exists: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime
    };
  } catch (error) {
    return {
      exists: false,
      isDirectory: false,
      error: error.code
    };
  }
}

function collectAllAssets(filePath, baseDir, visited = new Set(), allAssets = []) {
  const absolutePath = path.resolve(filePath);
  
  if (visited.has(absolutePath)) {
    return allAssets;
  }
  visited.add(absolutePath);
  
  const ext = path.extname(filePath).toLowerCase();
  
  let currentAssets = [];
  
  if (ext === '.html' || ext === '.htm') {
    const { parseHTML } = require('../parsers/html-parser');
    currentAssets = parseHTML(filePath, baseDir);
  } else if (ext === '.css') {
    const { parseCSS } = require('../parsers/css-parser');
    currentAssets = parseCSS(filePath, baseDir);
  }
  
  allAssets.push(...currentAssets);
  
  for (const asset of currentAssets) {
    const resolved = resolveAssetPath(asset.url, asset.filePath, baseDir);
    const assetExt = path.extname(resolved.absolutePath).toLowerCase();
    
    if ((assetExt === '.css' || assetExt === '.html' || assetExt === '.htm') && 
        checkFileExists(resolved.absolutePath).exists) {
      collectAllAssets(resolved.absolutePath, baseDir, visited, allAssets);
    }
  }
  
  return allAssets;
}

function findHTMLFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        findHTMLFiles(fullPath, files);
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.html' || ext === '.htm') {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

module.exports = {
  normalizePath,
  resolveAssetPath,
  checkFileExists,
  collectAllAssets,
  findHTMLFiles
};
