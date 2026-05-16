const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

class ReferenceScanner {
  constructor(codeDir, options = {}) {
    this.codeDir = codeDir;
    this.extensions = options.extensions || ['js', 'ts', 'jsx', 'tsx'];
    this.excludePatterns = options.excludePatterns || ['node_modules', '.git'];
    this.scanStats = {
      filesScanned: 0,
      linesScanned: 0,
      matchesFound: 0
    };
  }

  async scan(flags) {
    const references = [];
    const flagNames = flags.map(f => f.name);

    const patterns = this.extensions.map(ext => `**/*.${ext}`);

    const files = await glob(patterns, {
      cwd: this.codeDir,
      absolute: true,
      ignore: this.excludePatterns.map(p => `**/${p}/**`)
    });

    this.scanStats.filesScanned = files.length;

    for (const file of files) {
      const fileReferences = await this.scanFile(file, flagNames);
      references.push(...fileReferences);
    }

    this.scanStats.matchesFound = references.length;

    return { references, scanStats: this.scanStats };
  }

  async scanFile(filePath, flagNames) {
    const references = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      this.scanStats.linesScanned += lines.length;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        for (const flagName of flagNames) {
          const matches = this.findFlagInLine(line, flagName);

          for (const match of matches) {
            references.push({
              flagName,
              file: filePath,
              line: lineNumber,
              column: match.column,
              context: this.extractContext(line, match.column, flagName.length),
              matchType: match.type,
              relativePath: path.relative(this.codeDir, filePath)
            });
          }
        }
      }
    } catch (error) {
    }

    return references;
  }

  findFlagInLine(line, flagName) {
    const matches = [];
    const escapedName = flagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const patterns = [
      { regex: new RegExp(`['"]${escapedName}['"]`, 'g'), type: 'string_literal' },
      { regex: new RegExp(`\\b${escapedName}\\b`, 'g'), type: 'identifier' },
      { regex: new RegExp(`getFeatureFlag\\s*\\(\\s*['"]${escapedName}['"]`, 'g'), type: 'getter_call' },
      { regex: new RegExp(`isEnabled\\s*\\(\\s*['"]${escapedName}['"]`, 'g'), type: 'isEnabled_call' },
      { regex: new RegExp(`featureFlag\\s*=\\s*['"]${escapedName}['"]`, 'g'), type: 'assignment' }
    ];

    for (const { regex, type } of patterns) {
      let match;
      while ((match = regex.exec(line)) !== null) {
        matches.push({
          column: match.index + 1,
          type
        });
      }
    }

    const uniqueMatches = [];
    const columns = new Set();
    for (const m of matches) {
      if (!columns.has(m.column)) {
        columns.add(m.column);
        uniqueMatches.push(m);
      }
    }

    return uniqueMatches;
  }

  extractContext(line, column, length) {
    const start = Math.max(0, column - 30);
    const end = Math.min(line.length, column + length + 30);

    let context = line.slice(start, end);

    if (start > 0) {
      context = '...' + context;
    }
    if (end < line.length) {
      context = context + '...';
    }

    return context.trim();
  }
}

module.exports = { ReferenceScanner };
