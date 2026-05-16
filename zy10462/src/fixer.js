const fs = require('fs');
const path = require('path');

function generateFixedUrl(link, suggestedFix) {
  if (!suggestedFix) return null;
  
  const url = link.url;
  const hashIndex = url.indexOf('#');
  
  if (hashIndex === 0) {
    return `#${suggestedFix.newAnchor}`;
  } else if (hashIndex > 0) {
    return url.substring(0, hashIndex + 1) + suggestedFix.newAnchor;
  }
  
  return null;
}

function applyFixToContent(content, link, fixedUrl) {
  const lines = content.split('\n');
  const lineIndex = link.line - 1;
  
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return null;
  }
  
  const line = lines[lineIndex];
  const columnIndex = link.column - 1;
  
  if (columnIndex < 0 || columnIndex >= line.length) {
    return null;
  }
  
  const oldRaw = link.raw;
  const newRaw = oldRaw.replace(`(${link.url})`, `(${fixedUrl})`).replace(`<${link.url}>`, `<${fixedUrl}>`);
  
  if (oldRaw === newRaw) {
    return null;
  }
  
  const newLine = line.substring(0, columnIndex) + 
                  line.substring(columnIndex).replace(oldRaw, newRaw);
  
  lines[lineIndex] = newLine;
  
  return {
    newContent: lines.join('\n'),
    oldLine: line,
    newLine
  };
}

function generateFixPreview(brokenLinks) {
  const fixPreviews = [];
  const filesToFix = new Map();
  
  for (const link of brokenLinks) {
    if (!link.suggestedFix) {
      continue;
    }
    
    const fixedUrl = generateFixedUrl(link, link.suggestedFix);
    
    if (!fixedUrl) {
      continue;
    }
    
    const fileFixes = filesToFix.get(link.file) || [];
    fileFixes.push({
      link,
      fixedUrl
    });
    filesToFix.set(link.file, fileFixes);
    
    fixPreviews.push({
      file: link.file,
      line: link.line,
      column: link.column,
      oldLink: link.raw,
      newLink: link.raw.replace(`(${link.url})`, `(${fixedUrl})`).replace(`<${link.url}>`, `<${fixedUrl}>`),
      oldAnchor: link.targetAnchor,
      newAnchor: link.suggestedFix.newAnchor,
      newTitle: link.suggestedFix.newTitle,
      confidence: link.suggestedFix.confidence
    });
  }
  
  return {
    fixPreviews,
    filesToFix: Object.fromEntries(filesToFix)
  };
}

function applyFixes(filesToFix, parseResults) {
  const results = [];
  
  for (const [file, fixes] of Object.entries(filesToFix)) {
    const parseResult = parseResults[file];
    if (!parseResult) continue;
    
    let content = parseResult.content;
    const fileResults = [];
    
    const sortedFixes = [...fixes].sort((a, b) => b.link.line - a.link.line);
    
    for (const fix of sortedFixes) {
      const result = applyFixToContent(content, fix.link, fix.fixedUrl);
      
      if (result) {
        content = result.newContent;
        fileResults.push({
          line: fix.link.line,
          oldLine: result.oldLine,
          newLine: result.newLine,
          success: true
        });
      } else {
        fileResults.push({
          line: fix.link.line,
          success: false,
          reason: '无法应用修复'
        });
      }
    }
    
    results.push({
      file,
      fixes: fileResults,
      newContent: content,
      successCount: fileResults.filter(f => f.success).length,
      failCount: fileResults.filter(f => !f.success).length
    });
  }
  
  return results;
}

function writeFixedFiles(applyResults, outputDir) {
  const fixedDir = path.join(outputDir, 'fixed-files');
  
  if (!fs.existsSync(fixedDir)) {
    fs.mkdirSync(fixedDir, { recursive: true });
  }
  
  const writtenFiles = [];
  
  for (const result of applyResults) {
    const relativePath = path.relative(process.cwd(), result.file);
    const outputPath = path.join(fixedDir, relativePath);
    
    const outputFileDir = path.dirname(outputPath);
    if (!fs.existsSync(outputFileDir)) {
      fs.mkdirSync(outputFileDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, result.newContent, 'utf-8');
    
    writtenFiles.push({
      original: result.file,
      fixed: outputPath,
      successCount: result.successCount,
      failCount: result.failCount
    });
  }
  
  return writtenFiles;
}

module.exports = {
  generateFixPreview,
  applyFixes,
  writeFixedFiles,
  generateFixedUrl
};
