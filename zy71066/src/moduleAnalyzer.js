const config = require('./config');

class ModuleAnalyzer {
  constructor() {
    this.moduleConfig = config.get('modules') || {};
    this.compiledPatterns = this.compilePatterns();
  }

  compilePatterns() {
    const patterns = {};
    for (const [moduleName, keywords] of Object.entries(this.moduleConfig)) {
      patterns[moduleName] = keywords.map(keyword => ({
        keyword,
        regex: new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi'),
        weight: keyword.length > 2 ? 1 : 0.5
      }));
    }
    return patterns;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  analyze(content, owners = null) {
    const moduleScores = {};
    const moduleMatches = {};

    for (const [moduleName, patterns] of Object.entries(this.compiledPatterns)) {
      let score = 0;
      const matches = [];

      for (const pattern of patterns) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
          score += pattern.weight;
          matches.push({
            keyword: pattern.keyword,
            position: match.index,
            raw: match[0]
          });
        }
      }

      if (score > 0) {
        moduleScores[moduleName] = score;
        moduleMatches[moduleName] = matches;
      }
    }

    const sortedModules = Object.entries(moduleScores)
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => ({
        name,
        score,
        confidence: this.calculateConfidence(score, moduleMatches[name]),
        matches: moduleMatches[name],
        owner: owners ? this.findOwner(name, owners) : null
      }));

    const primaryModules = this.selectPrimaryModules(sortedModules);

    return {
      all: sortedModules,
      primary: primaryModules,
      isAmbiguous: sortedModules.length > 1 && sortedModules[0].score === sortedModules[1]?.score
    };
  }

  calculateConfidence(score, matches) {
    const baseConfidence = Math.min(score * 0.2, 1);
    const uniqueKeywords = new Set(matches.map(m => m.keyword.toLowerCase())).size;
    const keywordBonus = Math.min(uniqueKeywords * 0.1, 0.3);
    return Math.min(baseConfidence + keywordBonus, 1);
  }

  selectPrimaryModules(sortedModules) {
    if (sortedModules.length === 0) {
      return [];
    }

    const threshold = sortedModules[0].score * 0.5;
    return sortedModules.filter(m => m.score >= threshold && m.confidence >= 0.3);
  }

  findOwner(moduleName, owners) {
    if (!owners) return null;

    if (owners[moduleName]) {
      return owners[moduleName];
    }

    for (const [key, value] of Object.entries(owners)) {
      if (moduleName.includes(key) || key.includes(moduleName)) {
        return value;
      }
    }

    return owners['default'] || owners['*'] || null;
  }

  getStats(entries) {
    const stats = {};

    for (const entry of entries) {
      for (const mod of entry.modules.primary) {
        if (!stats[mod.name]) {
          stats[mod.name] = {
            count: 0,
            entries: [],
            owner: mod.owner
          };
        }
        stats[mod.name].count++;
        stats[mod.name].entries.push(entry.id);
      }
    }

    return stats;
  }

  addCustomModule(name, keywords) {
    this.moduleConfig[name] = keywords;
    this.compiledPatterns[name] = keywords.map(keyword => ({
      keyword,
      regex: new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi'),
      weight: keyword.length > 2 ? 1 : 0.5
    }));
  }
}

module.exports = ModuleAnalyzer;
