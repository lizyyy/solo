const fs = require('fs');
const path = require('path');
const { remark } = require('remark');
const remarkGfm = require('remark-gfm');

function generateAnchor(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deduplicateAnchors(anchors) {
  const countMap = new Map();
  const result = [];

  for (const anchor of anchors) {
    const baseAnchor = anchor.anchor;
    let count = countMap.get(baseAnchor) || 0;
    
    if (count > 0) {
      anchor.anchor = `${baseAnchor}-${count}`;
    }
    
    countMap.set(baseAnchor, count + 1);
    result.push(anchor);
  }

  return result;
}

async function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const anchors = [];
  const links = [];

  const headingRegex = /^(#{1,6})\s+(.+)$/;
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)|<([^>]+)>/g;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const headingMatch = line.match(headingRegex);
    
    if (headingMatch) {
      const level = headingMatch[1].length;
      const titleText = headingMatch[2].trim();
      const anchor = generateAnchor(titleText);
      
      anchors.push({
        file: filePath,
        line: lineNum + 1,
        level,
        title: titleText,
        anchor
      });
    }

    let linkMatch;
    while ((linkMatch = linkRegex.exec(line)) !== null) {
      const linkText = linkMatch[1] || linkMatch[3];
      const linkUrl = linkMatch[2] || linkMatch[3];
      
      if (linkUrl && (linkUrl.startsWith('#') || linkUrl.includes('#'))) {
        links.push({
          file: filePath,
          line: lineNum + 1,
          column: linkMatch.index + 1,
          text: linkText,
          url: linkUrl,
          raw: linkMatch[0]
        });
      }
    }
  }

  return {
    file: filePath,
    anchors: deduplicateAnchors(anchors),
    links,
    content,
    lines
  };
}

function resolveLink(baseFile, linkUrl) {
  const hashIndex = linkUrl.indexOf('#');
  let targetFile = null;
  let targetAnchor = null;

  if (hashIndex === 0) {
    targetFile = baseFile;
    targetAnchor = linkUrl.substring(1);
  } else if (hashIndex > 0) {
    const filePath = linkUrl.substring(0, hashIndex);
    targetAnchor = linkUrl.substring(hashIndex + 1);
    
    if (filePath.endsWith('.md')) {
      const baseDir = path.dirname(baseFile);
      targetFile = path.resolve(baseDir, filePath);
    }
  }

  return { targetFile, targetAnchor };
}

module.exports = {
  parseFile,
  generateAnchor,
  resolveLink
};
