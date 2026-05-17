const UAParser = require('ua-parser-js');
const { parseTimestamp } = require('../parsers/log-parser');

class BotFilterEngine {
  constructor(config, options = {}) {
    this.config = config;
    this.rules = config.rules;
    this.scoring = config.scoring;
    this.options = options;
    this.sampleCount = parseInt(options.sampleCount || '50', 10);
    this.uaParser = new UAParser();
  }

  analyze(records) {
    const botRecords = [];
    const suspiciousRecords = [];
    const cleanRecords = [];
    const ipStats = {};
    const uaStats = {};
    const pathStats = {};
    const matchedRules = {};

    records.forEach(record => {
      const result = this.analyzeRecord(record);

      if (!ipStats[record.ip]) {
        ipStats[record.ip] = { count: 0, botCount: 0, records: [] };
      }
      ipStats[record.ip].count++;
      ipStats[record.ip].records.push(record);
      if (result.classification !== 'clean') {
        ipStats[record.ip].botCount++;
      }

      const uaKey = record.userAgent || 'EMPTY_UA';
      if (!uaStats[uaKey]) {
        uaStats[uaKey] = { count: 0, botCount: 0 };
      }
      uaStats[uaKey].count++;
      if (result.classification !== 'clean') {
        uaStats[uaKey].botCount++;
      }

      if (!pathStats[record.path]) {
        pathStats[record.path] = { count: 0, botCount: 0 };
      }
      pathStats[record.path].count++;
      if (result.classification !== 'clean') {
        pathStats[record.path].botCount++;
      }

      result.matchedRules.forEach(rule => {
        if (!matchedRules[rule]) {
          matchedRules[rule] = 0;
        }
        matchedRules[rule]++;
      });

      record.analysis = result;

      if (result.classification === 'bot') {
        botRecords.push(record);
      } else if (result.classification === 'suspicious') {
        suspiciousRecords.push(record);
      } else {
        cleanRecords.push(record);
      }
    });

    const topBotIPs = Object.entries(ipStats)
      .filter(([_, stats]) => stats.botCount > 0)
      .sort((a, b) => b[1].botCount - a[1].botCount)
      .slice(0, 20)
      .map(([ip, stats]) => ({ ip, ...stats }));

    const topBotUAs = Object.entries(uaStats)
      .filter(([_, stats]) => stats.botCount > 0)
      .sort((a, b) => b[1].botCount - a[1].botCount)
      .slice(0, 20)
      .map(([ua, stats]) => ({ userAgent: ua, ...stats }));

    const topSuspiciousPaths = Object.entries(pathStats)
      .filter(([_, stats]) => stats.botCount > 0)
      .sort((a, b) => b[1].botCount - a[1].botCount)
      .slice(0, 20)
      .map(([path, stats]) => ({ path, ...stats }));

    return {
      totalRecords: records.length,
      botCount: botRecords.length,
      suspiciousCount: suspiciousRecords.length,
      cleanCount: cleanRecords.length,
      botRecords: this.takeSamples(botRecords, this.sampleCount),
      suspiciousRecords: this.takeSamples(suspiciousRecords, this.sampleCount),
      cleanRecords: this.takeSamples(cleanRecords, this.sampleCount),
      allBotRecords: botRecords,
      allSuspiciousRecords: suspiciousRecords,
      allCleanRecords: cleanRecords,
      topBotIPs,
      topBotUAs,
      topSuspiciousPaths,
      matchedRules,
      scoring: this.calculateScoringSummary(records)
    };
  }

  analyzeRecord(record) {
    let score = 0;
    const matchedRules = [];
    const details = {};

    if (!record.userAgent || record.userAgent === '-' || record.userAgent === '') {
      score += this.scoring.emptyUA;
      matchedRules.push('empty_ua');
      details.emptyUA = true;
    } else {
      const isKnownBot = this.rules.userAgents.knownBots.some(bot =>
        record.userAgent.toLowerCase().includes(bot.toLowerCase())
      );
      if (isKnownBot) {
        score += this.scoring.knownBot;
        matchedRules.push('known_bot_ua');
        details.knownBot = true;
      }

      const hasSuspiciousPattern = this.rules.userAgents.suspiciousPatterns.some(pattern =>
        pattern.test(record.userAgent)
      );
      if (hasSuspiciousPattern && !isKnownBot) {
        score += this.scoring.suspiciousUA;
        matchedRules.push('suspicious_ua_pattern');
        details.suspiciousUA = true;
      }
    }

    const isPrivateIP = this.rules.ips.privateRanges.some(range =>
      range.test(record.ip)
    );
    if (isPrivateIP) {
      score += this.scoring.privateIP;
      matchedRules.push('private_ip_range');
      details.privateIP = true;
    }

    if (this.rules.ips.knownBadIPs.includes(record.ip)) {
      score += 50;
      matchedRules.push('known_bad_ip');
      details.knownBadIP = true;
    }

    const hasSuspiciousPath = this.rules.paths.suspiciousPatterns.some(pattern =>
      pattern.test(record.path)
    );
    if (hasSuspiciousPath) {
      score += this.scoring.suspiciousPath;
      matchedRules.push('suspicious_path');
      details.suspiciousPath = true;
    }

    const hasScannerPath = this.rules.paths.scannerPatterns.some(pattern =>
      pattern.test(record.path)
    );
    if (hasScannerPath) {
      score += this.scoring.scannerPath;
      matchedRules.push('scanner_path_pattern');
      details.scannerPath = true;
    }

    if (this.rules.statusCodes.errorCodes.includes(record.status)) {
      details.errorStatusCode = record.status;
    }

    let classification = 'clean';
    if (score >= this.scoring.botThreshold) {
      classification = 'bot';
    } else if (score >= this.scoring.suspiciousThreshold) {
      classification = 'suspicious';
    }

    return {
      score,
      classification,
      matchedRules,
      details
    };
  }

  calculateScoringSummary(records) {
    const scoreRanges = {
      '0-19': 0,
      '20-39': 0,
      '40-59': 0,
      '60-79': 0,
      '80-100': 0,
      '100+': 0
    };

    records.forEach(record => {
      const score = record.analysis?.score || 0;
      if (score < 20) scoreRanges['0-19']++;
      else if (score < 40) scoreRanges['20-39']++;
      else if (score < 60) scoreRanges['40-59']++;
      else if (score < 80) scoreRanges['60-79']++;
      else if (score <= 100) scoreRanges['80-100']++;
      else scoreRanges['100+']++;
    });

    return scoreRanges;
  }

  takeSamples(records, count) {
    if (records.length <= count) {
      return records;
    }
    const step = Math.floor(records.length / count);
    const samples = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(i * step, records.length - 1);
      samples.push(records[idx]);
    }
    return samples;
  }
}

module.exports = {
  BotFilterEngine
};
