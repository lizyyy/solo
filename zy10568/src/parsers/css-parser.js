const fs = require('fs');
const path = require('path');
const { findLineNumber } = require('./html-parser');

const CSS_ASSET_PATTERNS = {
  url: /url\(\s*["']?([^"')\s]+)["']?\s*\)/gi,
  importRule: /@import\s+["']([^"']+)["']/gi
};

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif'];
const FONT_EXTENSIONS = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];

function parseCSS(filePath, baseDir) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const assets = [];
  const relativePath = path.relative(baseDir, filePath);

  for (const [patternName, regex] of Object.entries(CSS_ASSET_PATTERNS)) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const assetValue = match[1];
      const lineNumber = findLineNumber(content, match.index);
      const columnNumber = match.index - content.lastIndexOf('\n', match.index - 1);

      if (!assetValue.startsWith('data:') && !assetValue.startsWith('http://') && !assetValue.startsWith('https://') && !assetValue.startsWith('//')) {
        let assetType = 'other';
        const lowerValue = assetValue.toLowerCase();
        
        if (IMAGE_EXTENSIONS.some(ext => lowerValue.endsWith(ext))) {
          assetType = 'image';
        } else if (FONT_EXTENSIONS.some(ext => lowerValue.endsWith(ext))) {
          assetType = 'font';
        } else if (patternName === 'importRule' || lowerValue.endsWith('.css')) {
          assetType = 'css';
        }

        assets.push({
          type: assetType,
          url: assetValue,
          source: 'css',
          pattern: patternName,
          filePath: relativePath,
          line: lineNumber,
          column: columnNumber,
          rawValue: assetValue,
          context: content.substring(Math.max(0, match.index - 30), Math.min(content.length, match.index + match[0].length + 10))
        });
      }
    }
  }

  return assets;
}

module.exports = { parseCSS };
