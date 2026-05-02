import fs from 'fs';
import path from 'path';

export function checkFileNaming(shotList, mediaDir) {
  const issues = [];
  const existingFiles = getFilesInDirectory(mediaDir);
  const nameToFiles = groupFilesByName(existingFiles);
  
  for (const shot of shotList) {
    const expectedName = shot.filename || shot.name;
    if (!expectedName) {
      issues.push({
        type: 'file_naming',
        severity: 'error',
        message: `第 ${shot.lineNumber} 行缺少文件名`,
        shotId: shot.id,
        filename: expectedName
      });
      continue;
    }
    
    const baseName = getBaseName(expectedName);
    const hasFile = nameToFiles[baseName];
    
    if (!hasFile) {
      issues.push({
        type: 'file_naming',
        severity: 'error',
        message: `文件不存在: ${expectedName}`,
        shotId: shot.id,
        filename: expectedName
      });
    } else if (hasFile.length > 1) {
      issues.push({
        type: 'file_naming',
        severity: 'warning',
        message: `存在同名不同后缀的文件: ${hasFile.join(', ')}`,
        shotId: shot.id,
        filename: expectedName
      });
    }
  }
  
  return issues;
}

function getFilesInDirectory(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile());
}

function getBaseName(filename) {
  const ext = path.extname(filename).toLowerCase();
  return filename.slice(0, -ext.length);
}

function groupFilesByName(files) {
  const groups = {};
  for (const file of files) {
    const baseName = getBaseName(file);
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push(file);
  }
  return groups;
}