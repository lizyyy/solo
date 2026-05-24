const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const url = require('url');

class LinkChecker {
  constructor(options = {}) {
    this.checkExternal = options.checkExternal !== false;
    this.externalTimeout = options.externalTimeout || 5000;
    this.baseDir = options.baseDir || process.cwd();
    this.anchors = new Map();
    this.links = [];
    this.results = [];
  }

  registerAnchors(headings, filePath) {
    const fileAnchors = [];
    headings.forEach(heading => {
      fileAnchors.push({
        anchor: heading.anchor,
        text: heading.text,
        lineNumber: heading.lineNumber,
        headingLevel: heading.level
      });
    });
    this.anchors.set(filePath, fileAnchors);
  }

  parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseContent(content, filePath);
  }

  parseContent(content, filePath) {
    const lines = content.split('\n');
    const fileLinks = [];
    
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    const autoLinkRegex = /<(https?:\/\/[^>]+)>/g;
    const refLinkRegex = /\[([^\]]+)\]\[([^\]]*)\]/g;
    const refDefRegex = /^\s*\[([^\]]+)\]:\s*(\S+)/gm;
    
    let inCodeBlock = false;
    const refDefinitions = new Map();
    
    let refMatch;
    while ((refMatch = refDefRegex.exec(content)) !== null) {
      const refName = refMatch[1].toLowerCase();
      const refUrl = refMatch[2];
      refDefinitions.set(refName, refUrl);
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      if (inCodeBlock) continue;
      if (line.trim().startsWith('[')) {
        const defMatch = line.match(/^\s*\[([^\]]+)\]:\s*(\S+)/);
        if (defMatch) continue;
      }
      
      let match;
      const linkRegexCopy = new RegExp(linkRegex.source, 'g');
      while ((match = linkRegexCopy.exec(line)) !== null) {
        const linkText = match[1];
        const linkTarget = match[2].trim();
        const column = match.index + 1;
        
        fileLinks.push(this._parseLink(linkText, linkTarget, filePath, lineNumber, column));
      }
      
      const autoLinkRegexCopy = new RegExp(autoLinkRegex.source, 'g');
      while ((match = autoLinkRegexCopy.exec(line)) !== null) {
        const linkTarget = match[1];
        const column = match.index + 1;
        
        fileLinks.push(this._parseLink(linkTarget, linkTarget, filePath, lineNumber, column));
      }
      
      const refLinkRegexCopy = new RegExp(refLinkRegex.source, 'g');
      while ((match = refLinkRegexCopy.exec(line)) !== null) {
        const linkText = match[1];
        const refName = (match[2] || linkText).toLowerCase();
        const column = match.index + 1;
        
        if (refDefinitions.has(refName)) {
          const linkTarget = refDefinitions.get(refName);
          fileLinks.push(this._parseLink(linkText, linkTarget, filePath, lineNumber, column));
        } else {
          fileLinks.push({
            type: 'unknown',
            text: linkText,
            target: `[${refName}]`,
            filePath,
            lineNumber,
            column,
            error: '未找到引用定义',
            status: 'error'
          });
        }
      }
    }
    
    this.links = this.links.concat(fileLinks);
    return fileLinks;
  }

  _parseLink(text, target, filePath, lineNumber, column) {
    const link = {
      text,
      target,
      filePath,
      lineNumber,
      column
    };
    
    if (target.startsWith('#')) {
      link.type = 'anchor';
      link.anchor = target.slice(1);
      link.targetFile = filePath;
    } else if (target.includes('#')) {
      const parts = target.split('#');
      link.type = 'file-anchor';
      link.targetFile = this._resolvePath(parts[0], filePath);
      link.anchor = parts[1];
    } else if (target.startsWith('http://') || target.startsWith('https://')) {
      link.type = 'external';
      link.url = target;
    } else if (target.startsWith('mailto:')) {
      link.type = 'mailto';
      link.email = target.slice(7);
    } else {
      link.type = 'file';
      link.targetFile = this._resolvePath(target, filePath);
    }
    
    return link;
  }

  _resolvePath(targetPath, currentFilePath) {
    const currentDir = path.dirname(currentFilePath);
    const resolved = path.resolve(currentDir, targetPath);
    return path.normalize(resolved);
  }

  async checkAllLinks() {
    this.results = [];
    
    for (const link of this.links) {
      const result = await this._checkLink(link);
      this.results.push(result);
    }
    
    return this.results;
  }

  async _checkLink(link) {
    const result = { ...link };
    
    switch (link.type) {
      case 'anchor':
        this._checkAnchorLink(result, link.targetFile, link.anchor);
        break;
      case 'file-anchor':
        this._checkFileAnchorLink(result, link.targetFile, link.anchor);
        break;
      case 'file':
        this._checkFileLink(result, link.targetFile);
        break;
      case 'external':
        if (this.checkExternal) {
          await this._checkExternalLink(result, link.url);
        } else {
          result.status = 'skipped';
          result.message = '跳过外链检查';
        }
        break;
      case 'mailto':
        result.status = 'skipped';
        result.message = '邮箱链接跳过检查';
        break;
      case 'unknown':
        result.status = 'error';
        break;
      default:
        result.status = 'unknown';
        result.message = '未知链接类型';
    }
    
    return result;
  }

  _checkAnchorLink(result, filePath, anchor) {
    if (!this.anchors.has(filePath)) {
      result.status = 'error';
      result.error = '未找到目标文件的锚点信息';
      return;
    }
    
    const fileAnchors = this.anchors.get(filePath);
    const found = fileAnchors.find(a => a.anchor === anchor);
    
    if (found) {
      result.status = 'ok';
      result.foundAnchor = found;
    } else {
      result.status = 'error';
      result.error = '锚点不存在';
      result.suggestions = this._findAnchorSuggestions(anchor, fileAnchors);
    }
  }

  _checkFileAnchorLink(result, filePath, anchor) {
    if (!fs.existsSync(filePath)) {
      result.status = 'error';
      result.error = '目标文件不存在';
      return;
    }
    
    if (!this.anchors.has(filePath)) {
      result.status = 'warning';
      result.warning = '目标文件未解析锚点信息，跳过锚点检查';
      return;
    }
    
    const fileAnchors = this.anchors.get(filePath);
    const found = fileAnchors.find(a => a.anchor === anchor);
    
    if (found) {
      result.status = 'ok';
      result.foundAnchor = found;
    } else {
      result.status = 'error';
      result.error = '锚点不存在';
      result.suggestions = this._findAnchorSuggestions(anchor, fileAnchors);
    }
  }

  _checkFileLink(result, filePath) {
    if (fs.existsSync(filePath)) {
      result.status = 'ok';
      result.resolvedPath = filePath;
    } else {
      result.status = 'error';
      result.error = '文件不存在';
    }
  }

  async _checkExternalLink(result, urlString) {
    try {
      const parsedUrl = new URL(urlString);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const response = await new Promise((resolve, reject) => {
        const req = protocol.get(urlString, {
          timeout: this.externalTimeout,
          headers: {
            'User-Agent': 'md-chapter-owner/1.0'
          }
        }, resolve);
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('请求超时'));
        });
      });
      
      result.statusCode = response.statusCode;
      
      if (response.statusCode >= 200 && response.statusCode < 400) {
        result.status = 'ok';
      } else {
        result.status = 'error';
        result.error = `HTTP ${response.statusCode}`;
      }
      
      response.destroy();
    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }
  }

  _findAnchorSuggestions(targetAnchor, availableAnchors, limit = 3) {
    const targetLower = targetAnchor.toLowerCase();
    const scored = availableAnchors.map(a => {
      const anchorLower = a.anchor.toLowerCase();
      let score = 0;
      
      if (anchorLower === targetLower) {
        score = 1;
      } else if (anchorLower.includes(targetLower) || targetLower.includes(anchorLower)) {
        const longer = Math.max(anchorLower.length, targetLower.length);
        const shorter = Math.min(anchorLower.length, targetLower.length);
        score = shorter / longer;
      }
      
      return { anchor: a, score };
    });
    
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.anchor);
  }

  getResults() {
    return this.results;
  }

  getBrokenLinks() {
    return this.results.filter(r => r.status === 'error');
  }

  getStatistics() {
    const total = this.results.length;
    const ok = this.results.filter(r => r.status === 'ok').length;
    const errors = this.results.filter(r => r.status === 'error').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    
    return { total, ok, errors, warnings, skipped };
  }
}

module.exports = LinkChecker;
