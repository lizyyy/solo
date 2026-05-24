const fs = require('fs');
const path = require('path');

class OwnerMatcher {
  constructor(ownerConfig = {}) {
    this.owners = new Map();
    this.aliasMap = new Map();
    this.emailMap = new Map();
    
    if (typeof ownerConfig === 'string') {
      this.loadFromFile(ownerConfig);
    } else if (Array.isArray(ownerConfig)) {
      this.loadFromArray(ownerConfig);
    } else if (typeof ownerConfig === 'object') {
      this.loadFromObject(ownerConfig);
    }
  }

  loadFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        this.loadFromArray(data);
      } else {
        this.loadFromObject(data);
      }
    } else if (ext === '.md' || ext === '.markdown') {
      this.loadFromMarkdown(filePath);
    } else {
      throw new Error(`不支持的负责人文件格式: ${ext}`);
    }
  }

  loadFromArray(ownersArray) {
    ownersArray.forEach(owner => {
      this._addOwner(owner);
    });
  }

  loadFromObject(ownerObj) {
    Object.entries(ownerObj).forEach(([name, config]) => {
      this._addOwner({
        name,
        ...(typeof config === 'string' ? { email: config } : config)
      });
    });
  }

  loadFromMarkdown(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let inTable = false;
    let headers = [];
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      if (line.trim().startsWith('|')) {
        const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
        
        if (!inTable) {
          if (cells.length >= 2 && cells.some(c => c.includes('姓名') || c.includes('负责人'))) {
            inTable = true;
            headers = cells;
          }
        } else {
          if (line.includes('---') || line.includes('===')) {
            return;
          }
          
          const ownerData = {};
          cells.forEach((cell, i) => {
            if (headers[i]) {
              const header = headers[i];
              if (header.includes('姓名') || header.includes('负责人')) {
                ownerData.name = cell;
              } else if (header.includes('别名') || header.includes('昵称')) {
                ownerData.aliases = cell.split(/[,，、]/).map(a => a.trim()).filter(a => a);
              } else if (header.includes('邮箱') || header.includes('email')) {
                ownerData.email = cell;
              }
            }
          });
          
          if (ownerData.name) {
            ownerData._source = { filePath, lineNumber };
            this._addOwner(ownerData);
          }
        }
      } else if (inTable && line.trim() === '') {
        inTable = false;
      }
    });
  }

  _addOwner(owner) {
    const canonicalName = owner.name;
    if (!canonicalName) return;
    
    const ownerEntry = {
      name: canonicalName,
      email: owner.email || null,
      aliases: owner.aliases || [],
      source: owner._source || null
    };
    
    this.owners.set(canonicalName, ownerEntry);
    
    this.aliasMap.set(canonicalName.toLowerCase(), canonicalName);
    
    if (ownerEntry.aliases) {
      ownerEntry.aliases.forEach(alias => {
        this.aliasMap.set(alias.toLowerCase(), canonicalName);
      });
    }
    
    if (ownerEntry.email) {
      this.emailMap.set(ownerEntry.email.toLowerCase(), canonicalName);
    }
  }

  match(input) {
    if (!input) {
      return {
        matched: false,
        input: input,
        error: '输入为空',
        suggestions: this._getTopSuggestions()
      };
    }
    
    const normalizedInput = input.trim().toLowerCase();
    
    if (this.aliasMap.has(normalizedInput)) {
      const canonicalName = this.aliasMap.get(normalizedInput);
      return {
        matched: true,
        input: input,
        canonicalName: canonicalName,
        owner: this.owners.get(canonicalName),
        matchType: this._getMatchType(input, canonicalName)
      };
    }
    
    if (this.emailMap.has(normalizedInput)) {
      const canonicalName = this.emailMap.get(normalizedInput);
      return {
        matched: true,
        input: input,
        canonicalName: canonicalName,
        owner: this.owners.get(canonicalName),
        matchType: 'email'
      };
    }
    
    const suggestions = this._findFuzzyMatches(input);
    
    return {
      matched: false,
      input: input,
      error: '未找到匹配的负责人',
      suggestions: suggestions
    };
  }

  _getMatchType(input, canonicalName) {
    if (input === canonicalName) return 'exact';
    if (input.toLowerCase() === canonicalName.toLowerCase()) return 'case-insensitive';
    return 'alias';
  }

  _findFuzzyMatches(input, limit = 5) {
    const inputLower = input.toLowerCase();
    const matches = [];
    
    this.owners.forEach((owner, name) => {
      const nameLower = name.toLowerCase();
      
      let score = 0;
      if (nameLower.includes(inputLower)) {
        score = inputLower.length / nameLower.length;
      }
      
      owner.aliases.forEach(alias => {
        const aliasLower = alias.toLowerCase();
        if (aliasLower.includes(inputLower)) {
          const aliasScore = inputLower.length / aliasLower.length;
          score = Math.max(score, aliasScore);
        }
      });
      
      if (score > 0) {
        matches.push({ name, score });
      }
    });
    
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(m => m.name);
  }

  _getTopSuggestions(limit = 5) {
    return Array.from(this.owners.keys()).slice(0, limit);
  }

  getAllOwners() {
    return Array.from(this.owners.values());
  }

  getOwnerNames() {
    return Array.from(this.owners.keys());
  }

  hasOwner(name) {
    return this.owners.has(name) || this.aliasMap.has(name.toLowerCase());
  }
}

module.exports = OwnerMatcher;
