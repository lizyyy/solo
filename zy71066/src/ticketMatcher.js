const config = require('./config');

class TicketMatcher {
  constructor() {
    this.patterns = config.get('ticket.patterns') || [];
    this.fallbackUrl = config.get('ticket.fallbackUrl');
  }

  match(content) {
    const results = [];
    const usedTickets = new Set();

    for (const pattern of this.patterns) {
      const matches = this.findPatternMatches(content, pattern, usedTickets);
      if (matches.length > 0) {
        results.push({
          type: pattern.name,
          pattern: pattern.regex.toString(),
          matches: matches
        });
        matches.forEach(m => usedTickets.add(m.id.toUpperCase()));
      }
    }

    const genericTickets = this.findGenericTickets(content, usedTickets);
    if (genericTickets.length > 0) {
      results.push({
        type: 'Generic',
        pattern: 'fallback',
        matches: genericTickets
      });
    }

    return results;
  }

  findPatternMatches(content, pattern, usedTickets) {
    const matches = [];
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags || 'gi');

    let match;
    while ((match = regex.exec(content)) !== null) {
      const ticketId = match[0];

      if (usedTickets.has(ticketId.toUpperCase())) {
        continue;
      }

      if (!this.isValidMatch(content, match.index, ticketId)) {
        continue;
      }

      let url = pattern.url;
      for (let i = 1; i < match.length; i++) {
        if (match[i]) {
          url = url.replace(`$${i}`, match[i]);
        }
      }

      matches.push({
        id: ticketId,
        url: url,
        position: match.index,
        raw: match[0]
      });
    }

    return matches;
  }

  findGenericTickets(content, usedTickets) {
    const matches = [];
    const patterns = [
      /\b([A-Z]{1,6})[-_](\d{2,8})\b/gi,
      /\b([A-Z]{1,6})\s+(\d{2,8})\b/gi,
      /\b([A-Z]{2,6})(\d{2,8})\b/gi
    ];

    for (const regex of patterns) {
      let match;
      const re = new RegExp(regex.source, regex.flags);
      while ((match = re.exec(content)) !== null) {
        const ticketId = match[1].toUpperCase() + '-' + match[2];

        if (usedTickets.has(ticketId)) {
          continue;
        }

        if (this.isLikelyFalsePositive(ticketId, content, match.index)) {
          continue;
        }

        const url = this.fallbackUrl.replace('{ticket}', ticketId);

        matches.push({
          id: ticketId,
          url: url,
          position: match.index,
          raw: match[0],
          isGeneric: true
        });

        usedTickets.add(ticketId);
      }
    }

    return matches;
  }

  isValidMatch(content, index, ticketId) {
    if (index > 0) {
      const beforeChar = content[index - 1];
      if (/[`'"]/.test(beforeChar)) {
        if (index > 1 && content[index - 2] === '`') {
          return false;
        }
      }
    }

    if (/^\d+$/.test(ticketId)) {
      return false;
    }

    return true;
  }

  isLikelyFalsePositive(ticketId, content, index) {
    const before = content.substring(Math.max(0, index - 20), index).toLowerCase();
    const after = content.substring(index, index + ticketId.length + 20).toLowerCase();
    const context = before + after;

    const falsePositiveIndicators = [
      /version|v\d|版本|号|日期|时间|date|time/i,
      /http|url|链接|地址/i,
      /sha|hash|commit|git/i,
      /md5|sha1|sha256|加密/i
    ];

    for (const indicator of falsePositiveIndicators) {
      if (indicator.test(context)) {
        return true;
      }
    }

    if (/^[A-Z]{1,2}\d{2,3}$/.test(ticketId)) {
      const wordBefore = before.trim().split(/\s+/).pop() || '';
      if (/^(by|from|in|at|on|of|to|for)$/i.test(wordBefore)) {
        return true;
      }
    }

    return false;
  }

  normalize(ticketId) {
    return ticketId.toUpperCase().replace(/[-_ ]/g, '-');
  }
}

module.exports = TicketMatcher;
