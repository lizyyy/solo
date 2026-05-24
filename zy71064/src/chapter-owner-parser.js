const fs = require('fs');
const path = require('path');

class ChapterOwnerParser {
  constructor(options = {}) {
    this.ownerMarker = options.ownerMarker || ['负责人', 'owner', 'Owner', 'OWNER'];
    this.reviewerMarker = options.reviewerMarker || ['评审人', 'reviewer', 'Reviewer', 'REVIEWER'];
    this.statusMarker = options.statusMarker || ['状态', 'status', 'Status', 'STATUS'];
    this.chapters = [];
  }

  parseFile(filePath, headings) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseContent(content, filePath, headings);
  }

  parseContent(content, filePath, headings) {
    const lines = content.split('\n');
    this.chapters = [];
    
    let currentChapter = null;
    let inCodeBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      if (inCodeBlock) continue;
      
      const headingMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s*\{#[\w-]+\})?\s*$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        
        const matchingHeading = headings.find(h => 
          h.lineNumber === lineNumber && h.text === text
        );
        
        if (matchingHeading) {
          if (currentChapter) {
            currentChapter.endLine = lineNumber - 1;
            this.chapters.push(currentChapter);
          }
          
          currentChapter = {
            heading: matchingHeading,
            startLine: lineNumber,
            endLine: null,
            owner: null,
            reviewers: [],
            status: null,
            filePath,
            metadata: {},
            unparsedRecords: []
          };
        }
      }
      
      if (currentChapter) {
        this._parseMetadataLine(line, lineNumber, currentChapter);
      }
    }
    
    if (currentChapter) {
      currentChapter.endLine = lines.length;
      this.chapters.push(currentChapter);
    }
    
    this._inheritOwnerToSubchapters();
    
    return this.chapters;
  }

  _parseMetadataLine(line, lineNumber, chapter) {
    const ownerMatch = this._matchMarker(line, this.ownerMarker);
    if (ownerMatch) {
      const owners = this._parseOwnerValue(ownerMatch.value, lineNumber, chapter.filePath);
      if (owners.length > 0) {
        chapter.owner = owners[0];
        if (owners.length > 1) {
          chapter.unparsedRecords.push({
            lineNumber,
            content: line,
            warning: '多个负责人，只取第一个',
            extraOwners: owners.slice(1)
          });
        }
      } else {
        chapter.unparsedRecords.push({
          lineNumber,
          content: line,
          error: '无法解析负责人'
        });
      }
      return;
    }
    
    const reviewerMatch = this._matchMarker(line, this.reviewerMarker);
    if (reviewerMatch) {
      const reviewers = this._parseOwnerValue(reviewerMatch.value, lineNumber, chapter.filePath);
      chapter.reviewers = reviewers;
      return;
    }
    
    const statusMatch = this._matchMarker(line, this.statusMarker);
    if (statusMatch) {
      chapter.status = statusMatch.value.trim();
      return;
    }
    
    const genericMatch = line.match(/^[\s>]*[-*]\s*([^:：]+)[:：]\s*(.+)$/);
    if (genericMatch) {
      const key = genericMatch[1].trim();
      const value = genericMatch[2].trim();
      if (!chapter.metadata[key]) {
        chapter.metadata[key] = value;
      }
    }
  }

  _matchMarker(line, markers) {
    for (const marker of markers) {
      const patterns = [
        new RegExp(`^[\\s>]*[-*]?\\s*${marker}\\s*[:：]\\s*(.+)$`, 'i'),
        new RegExp(`\\b${marker}\\s*[:：]\\s*([^,，、\\s]+)`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          return { marker, value: match[1] };
        }
      }
    }
    return null;
  }

  _parseOwnerValue(value, lineNumber, filePath) {
    const separators = /[,，、/\s]+/;
    const rawOwners = value.split(separators).map(o => o.trim()).filter(o => o);
    
    return rawOwners.map(owner => ({
      name: owner,
      source: { filePath, lineNumber },
      raw: owner
    }));
  }

  _inheritOwnerToSubchapters() {
    const sortedChapters = [...this.chapters].sort((a, b) => a.heading.lineNumber - b.heading.lineNumber);
    
    let ownerStack = [];
    
    sortedChapters.forEach(chapter => {
      while (ownerStack.length > 0 && ownerStack[ownerStack.length - 1].level >= chapter.heading.level) {
        ownerStack.pop();
      }
      
      if (!chapter.owner && ownerStack.length > 0) {
        const parentOwner = ownerStack[ownerStack.length - 1].owner;
        if (parentOwner) {
          chapter.owner = { ...parentOwner, inherited: true };
        }
      }
      
      if (chapter.owner) {
        ownerStack.push({
          level: chapter.heading.level,
          owner: chapter.owner
        });
      }
    });
  }

  getChapters() {
    return this.chapters;
  }

  getChaptersWithoutOwner() {
    return this.chapters.filter(c => !c.owner);
  }

  getChaptersByOwner(ownerName) {
    return this.chapters.filter(c => c.owner && c.owner.name === ownerName);
  }

  getOwnerStatistics() {
    const stats = new Map();
    
    this.chapters.forEach(chapter => {
      const ownerName = chapter.owner ? chapter.owner.name : '未分配';
      if (!stats.has(ownerName)) {
        stats.set(ownerName, { count: 0, chapters: [] });
      }
      stats.get(ownerName).count++;
      stats.get(ownerName).chapters.push(chapter.heading.text);
    });
    
    return stats;
  }

  getUnparsedRecords() {
    return this.chapters.flatMap(c => 
      c.unparsedRecords.map(r => ({
        ...r,
        heading: c.heading.text,
        filePath: c.filePath
      }))
    );
  }
}

module.exports = ChapterOwnerParser;
