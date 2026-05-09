const fs = require('fs');
const path = require('path');

class Whitelist {
  constructor() {
    this.entries = new Map();
    this.loadedFiles = new Set();
    this.lastModified = new Map();
  }

  loadFromFile(filePath) {
    const fullPath = path.resolve(filePath);
    const isRepeat = this.loadedFiles.has(fullPath);

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: '文件不存在',
        filePath: fullPath
      };
    }

    const stat = fs.statSync(fullPath);
    const mtime = stat.mtimeMs;
    const hasChanged = isRepeat && this.lastModified.get(fullPath) !== mtime;

    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch (e) {
      return {
        success: false,
        error: '文件读取失败',
        filePath: fullPath,
        details: e.message
      };
    }

    let whitelistData;
    try {
      whitelistData = JSON.parse(content);
    } catch (e) {
      return {
        success: false,
        error: 'JSON 解析失败',
        filePath: fullPath,
        details: e.message
      };
    }

    if (!Array.isArray(whitelistData)) {
      return {
        success: false,
        error: '白名单格式错误，应为数组',
        filePath: fullPath
      };
    }

    const added = [];
    const updated = [];
    const invalid = [];

    for (let i = 0; i < whitelistData.length; i++) {
      const entry = whitelistData[i];

      if (!entry || typeof entry !== 'object') {
        invalid.push({ index: i, reason: '条目不是对象' });
        continue;
      }

      if (!entry.id && !entry.match && !entry.ruleId) {
        invalid.push({ index: i, reason: '条目缺少 id、match 或 ruleId 字段' });
        continue;
      }

      const id = entry.id || `${entry.ruleId || 'all'}-${entry.match || 'global'}`;

      const fullEntry = {
        id,
        match: entry.match,
        ruleId: entry.ruleId,
        filePath: entry.filePath,
        reason: entry.reason || '',
        source: fullPath,
        pattern: entry.pattern ? new RegExp(entry.pattern) : null
      };

      if (this.entries.has(id)) {
        updated.push(id);
      } else {
        added.push(id);
      }

      this.entries.set(id, fullEntry);
    }

    this.loadedFiles.add(fullPath);
    this.lastModified.set(fullPath, mtime);

    return {
      success: true,
      filePath: fullPath,
      isRepeat,
      hasChanged,
      added,
      updated,
      invalid,
      total: this.entries.size
    };
  }

  loadFromDirectory(dirPath) {
    const fullDir = path.resolve(dirPath);

    if (!fs.existsSync(fullDir)) {
      return {
        success: false,
        error: '目录不存在',
        dirPath: fullDir
      };
    }

    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.json'));
    const results = [];

    for (const file of files) {
      const filePath = path.join(fullDir, file);
      results.push(this.loadFromFile(filePath));
    }

    return {
      success: true,
      dirPath: fullDir,
      files: results,
      total: this.entries.size
    };
  }

  isWhitelisted(finding) {
    for (const [id, entry] of this.entries) {
      if (this.matchesEntry(finding, entry)) {
        return { whitelisted: true, entry };
      }
    }
    return { whitelisted: false };
  }

  matchesEntry(finding, entry) {
    if (entry.ruleId && entry.ruleId !== finding.ruleId) {
      return false;
    }

    if (entry.filePath && entry.filePath !== finding.source) {
      return false;
    }

    if (entry.match && entry.match !== finding.match) {
      return false;
    }

    if (entry.pattern && !entry.pattern.test(finding.match)) {
      return false;
    }

    return true;
  }

  filterFindings(findings) {
    const allowed = [];
    const excluded = [];

    for (const finding of findings) {
      const result = this.isWhitelisted(finding);
      if (result.whitelisted) {
        excluded.push({ ...finding, whitelistEntry: result.entry });
      } else {
        allowed.push(finding);
      }
    }

    return { allowed, excluded };
  }

  hasChanged(filePath) {
    const fullPath = path.resolve(filePath);
    if (!this.loadedFiles.has(fullPath)) return true;
    const stat = fs.statSync(fullPath);
    return stat.mtimeMs !== this.lastModified.get(fullPath);
  }

  getEntries() {
    return Array.from(this.entries.values());
  }

  getEntry(id) {
    return this.entries.get(id);
  }
}

module.exports = { Whitelist };
