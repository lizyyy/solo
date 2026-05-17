const fs = require('fs');
const path = require('path');

const HTML_ASSET_PATTERNS = {
  imgSrc: /<img[^>]+src=["']([^"']+)["']/gi,
  imgSrcset: /<img[^>]+srcset=["']([^"']+)["']/gi,
  linkHref: /<link[^>]+href=["']([^"']+)["']/gi,
  scriptSrc: /<script[^>]+src=["']([^"']+)["']/gi,
  videoPoster: /<video[^>]+poster=["']([^"']+)["']/gi,
  videoSrc: /<video[^>]+src=["']([^"']+)["']/gi,
  sourceSrc: /<source[^>]+src=["']([^"']+)["']/gi,
  sourceSrcset: /<source[^>]+srcset=["']([^"']+)["']/gi,
  audioSrc: /<audio[^>]+src=["']([^"']+)["']/gi,
  objectData: /<object[^>]+data=["']([^"']+)["']/gi,
  embedSrc: /<embed[^>]+src=["']([^"']+)["']/gi,
  iframeSrc: /<iframe[^>]+src=["']([^"']+)["']/gi,
  metaOgImage: /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
  metaTwitterImage: /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
  styleInline: /<style[^>]*>([\s\S]*?)<\/style>/gi
};

function parseSrcset(srcset) {
  const urls = [];
  const entries = srcset.split(',');
  for (const entry of entries) {
    const parts = entry.trim().split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      urls.push(parts[0]);
    }
  }
  return urls;
}

function findLineNumber(content, matchIndex) {
  const lines = content.substring(0, matchIndex).split('\n');
  return lines.length;
}

function parseHTML(filePath, baseDir) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const assets = [];
  const relativePath = path.relative(baseDir, filePath);

  for (const [patternName, regex] of Object.entries(HTML_ASSET_PATTERNS)) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (patternName === 'styleInline') {
        continue;
      }

      const assetValue = match[1];
      const lineNumber = findLineNumber(content, match.index);
      const columnNumber = match.index - content.lastIndexOf('\n', match.index - 1);

      if (patternName === 'imgSrcset' || patternName === 'sourceSrcset') {
        const urls = parseSrcset(assetValue);
        for (const url of urls) {
          if (!url.startsWith('data:') && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
            assets.push({
              type: 'image',
              url: url,
              source: 'html',
              pattern: patternName,
              filePath: relativePath,
              line: lineNumber,
              column: columnNumber,
              rawValue: assetValue,
              context: content.substring(Math.max(0, match.index - 50), Math.min(content.length, match.index + match[0].length + 20))
            });
          }
        }
      } else {
        if (!assetValue.startsWith('data:') && !assetValue.startsWith('http://') && !assetValue.startsWith('https://') && !assetValue.startsWith('//') && !assetValue.startsWith('#')) {
          let assetType = 'other';
          if (patternName.includes('img') || patternName.includes('image') || patternName.includes('poster')) {
            assetType = 'image';
          } else if (patternName.includes('link') && assetValue.endsWith('.css')) {
            assetType = 'css';
          } else if (patternName.includes('script')) {
            assetType = 'script';
          } else if (patternName.includes('video') || patternName.includes('audio')) {
            assetType = 'media';
          } else if (patternName.includes('font')) {
            assetType = 'font';
          }

          assets.push({
            type: assetType,
            url: assetValue,
            source: 'html',
            pattern: patternName,
            filePath: relativePath,
            line: lineNumber,
            column: columnNumber,
            rawValue: assetValue,
            context: content.substring(Math.max(0, match.index - 50), Math.min(content.length, match.index + match[0].length + 20))
          });
        }
      }
    }
  }

  return assets;
}

module.exports = { parseHTML, findLineNumber };
