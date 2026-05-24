const config = require('./config');

class RiskAnalyzer {
  constructor() {
    this.riskConfig = config.get('risk') || {};
    this.compiledKeywords = this.compileKeywords();
    this.safeContexts = this.riskConfig.safeContexts || [];
  }

  compileKeywords() {
    const result = {};
    const levels = ['high', 'medium', 'low'];

    for (const level of levels) {
      const keywords = this.riskConfig.keywords?.[level] || [];
      result[level] = keywords.map(keyword => ({
        keyword,
        regex: this.createKeywordRegex(keyword),
        weight: this.riskConfig.levels?.[level]?.weight || (level === 'high' ? 100 : level === 'medium' ? 50 : 10)
      }));
    }

    return result;
  }

  createKeywordRegex(keyword) {
    const escaped = this.escapeRegex(keyword);

    if (/[\u4e00-\u9fa5]/.test(keyword)) {
      return new RegExp(escaped, 'gi');
    } else {
      return new RegExp(`\\b${escaped}\\b`, 'gi');
    }
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  analyze(content) {
    const matchesByLevel = {
      high: [],
      medium: [],
      low: []
    };

    let totalScore = 0;

    for (const level of ['high', 'medium', 'low']) {
      for (const pattern of this.compiledKeywords[level]) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
          const context = this.getContext(content, match.index, match[0].length);

          if (this.isSafeContext(context)) {
            continue;
          }

          const riskMatch = {
            keyword: pattern.keyword,
            position: match.index,
            raw: match[0],
            context: context.text,
            weight: pattern.weight
          };

          matchesByLevel[level].push(riskMatch);
          totalScore += pattern.weight;
        }
      }
    }

    const level = this.determineLevel(totalScore, matchesByLevel);
    const explanation = this.generateExplanation(matchesByLevel, totalScore);

    return {
      level,
      score: totalScore,
      matches: matchesByLevel,
      explanation,
      hasFalsePositiveWarning: this.checkForFalsePositives(content, matchesByLevel)
    };
  }

  getContext(content, index, length) {
    const windowSize = 30;
    const start = Math.max(0, index - windowSize);
    const end = Math.min(content.length, index + length + windowSize);

    return {
      text: content.substring(start, end),
      start,
      end,
      matchStart: index - start,
      matchEnd: index - start + length
    };
  }

  isSafeContext(context) {
    const contextText = context.text.toLowerCase();

    for (const safeWord of this.safeContexts) {
      if (contextText.includes(safeWord.toLowerCase())) {
        const safeWordIndex = contextText.indexOf(safeWord.toLowerCase());
        const matchIndex = context.matchStart;

        if (Math.abs(safeWordIndex - matchIndex) < 50) {
          return true;
        }
      }
    }

    return false;
  }

  determineLevel(totalScore, matchesByLevel) {
    if (matchesByLevel.high.length > 0) {
      return 'high';
    }

    if (totalScore >= 50 || matchesByLevel.medium.length >= 2) {
      return 'medium';
    }

    if (totalScore > 0) {
      return 'low';
    }

    return 'none';
  }

  generateExplanation(matchesByLevel, totalScore) {
    const parts = [];

    if (matchesByLevel.high.length > 0) {
      const keywords = [...new Set(matchesByLevel.high.map(m => m.keyword))];
      parts.push(`检测到高危关键词: ${keywords.join(', ')}`);
    }

    if (matchesByLevel.medium.length > 0) {
      const keywords = [...new Set(matchesByLevel.medium.map(m => m.keyword))];
      parts.push(`检测到中危关键词: ${keywords.join(', ')}`);
    }

    if (matchesByLevel.low.length > 0 && matchesByLevel.high.length === 0 && matchesByLevel.medium.length === 0) {
      const keywords = [...new Set(matchesByLevel.low.map(m => m.keyword))];
      parts.push(`检测到低危关键词: ${keywords.join(', ')}`);
    }

    if (totalScore === 0) {
      parts.push('未检测到风险关键词');
    }

    parts.push(`风险评分: ${totalScore}`);

    return parts.join('; ');
  }

  checkForFalsePositives(content, matchesByLevel) {
    const allMatches = [
      ...matchesByLevel.high,
      ...matchesByLevel.medium,
      ...matchesByLevel.low
    ];

    for (const match of allMatches) {
      if (/修复|解决|处理|完善|优化/i.test(match.context.text)) {
        return true;
      }
    }

    return false;
  }

  getStats(entries) {
    const stats = {
      high: { count: 0, entries: [] },
      medium: { count: 0, entries: [] },
      low: { count: 0, entries: [] },
      none: { count: 0, entries: [] }
    };

    for (const entry of entries) {
      const level = entry.risk.level || 'none';
      if (!stats[level]) {
        stats[level] = { count: 0, entries: [] };
      }
      stats[level].count++;
      stats[level].entries.push(entry.id);
    }

    return stats;
  }

  addCustomKeyword(level, keyword, weight = null) {
    if (!this.compiledKeywords[level]) {
      this.compiledKeywords[level] = [];
    }

    const defaultWeight = level === 'high' ? 100 : level === 'medium' ? 50 : 10;

    this.compiledKeywords[level].push({
      keyword,
      regex: this.createKeywordRegex(keyword),
      weight: weight || defaultWeight
    });
  }
}

module.exports = RiskAnalyzer;
