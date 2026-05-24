const fs = require('fs');
const path = require('path');

class HeadingParser {
  constructor(options = {}) {
    this.anchorStyle = options.anchorStyle || 'github';
    this.headingCounts = new Map();
    this.headings = [];
  }

  static generateAnchor(text, style = 'github') {
    let anchor = text.toLowerCase();
    
    if (style === 'github') {
      anchor = anchor
        .replace(/[\s\n]+/g, '-')
        .replace(/[^\w\u4e00-\u9fa5-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    } else if (style === 'gitlab') {
      anchor = anchor
        .replace(/[\s\n]+/g, '-')
        .replace(/[^\w\u4e00-\u9fa5-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    
    return anchor;
  }

  parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseContent(content, filePath);
  }

  parseContent(content, filePath = 'unknown') {
    const lines = content.split('\n');
    this.headings = [];
    this.headingCounts.clear();
    
    const headingRegex = /^(#{1,6})\s+(.+?)(?:\s*\{#([\w-]+)\})?\s*$/;
    const setextRegex = /^([=-]+)\s*$/;
    
    let inCodeBlock = false;
    let prevLine = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      if (inCodeBlock) continue;
      
      const setextMatch = line.match(setextRegex);
      if (setextMatch && prevLine.trim() && !prevLine.trim().startsWith('#')) {
        const level = setextMatch[1][0] === '=' ? 1 : 2;
        this._addHeading(prevLine.trim(), level, lineNumber - 1, filePath);
        prevLine = '';
        continue;
      }
      
      const match = line.match(headingRegex);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const explicitAnchor = match[3];
        this._addHeading(text, level, lineNumber, filePath, explicitAnchor);
      }
      
      prevLine = line;
    }
    
    return this.headings;
  }

  _addHeading(text, level, lineNumber, filePath, explicitAnchor = null) {
    const baseAnchor = explicitAnchor || HeadingParser.generateAnchor(text, this.anchorStyle);
    
    let finalAnchor = baseAnchor;
    if (this.headingCounts.has(baseAnchor)) {
      const count = this.headingCounts.get(baseAnchor);
      finalAnchor = `${baseAnchor}-${count}`;
      this.headingCounts.set(baseAnchor, count + 1);
    } else {
      this.headingCounts.set(baseAnchor, 1);
    }
    
    this.headings.push({
      text,
      level,
      lineNumber,
      filePath,
      anchor: finalAnchor,
      baseAnchor,
      explicitAnchor: !!explicitAnchor,
      id: `${filePath}:${lineNumber}`
    });
  }

  getHeadings() {
    return this.headings;
  }

  findHeadingByAnchor(anchor) {
    return this.headings.find(h => h.anchor === anchor);
  }

  findHeadingsByText(text) {
    return this.headings.filter(h => h.text === text);
  }

  getHeadingTree() {
    const tree = [];
    const stack = [];
    
    this.headings.forEach(heading => {
      const node = { ...heading, children: [] };
      
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        tree.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      
      stack.push(node);
    });
    
    return tree;
  }
}

module.exports = HeadingParser;
